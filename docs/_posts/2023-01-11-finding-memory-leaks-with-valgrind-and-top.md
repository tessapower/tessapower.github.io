---
title: "Finding memory leaks with Valgrind and Top"
layout: post
tags: [c++, memory leaks, valgrind, top, debugging, linux]
---

In this post, I'm going to cover my go-to workflow for tracking down memory
leaks in C++. If your program's memory usage is climbing and it shouldn't be,
two tools will get you to the answer fast: `Top` tells you *if* you're leaking,
and `Valgrind` tells you *where*.

Every `new` or `malloc` in C++ needs a matching `delete`/`delete[]` or `free`.
Miss one and memory silently accumulates — your program works fine until it
doesn't. These are my notes to myself for the next time I need to debug one.

<!--more-->

## Table of Contents
{:.no_toc}

* TOC
{:toc}

---

## [Spotting the Problem with Top](#spotting-the-problem-with-top)

`Top` shows running Linux processes and their resource usage. By itself it's
noisy — processes jump around and it's hard to keep track of the one you want:

![Top displaying Linux Processes]({{ site.baseurl }}/images/posts/2023-01-11-finding-memory-leaks-with-valgrind-and-top/top.png)

We can use the `-p` switch and pass `Top` the PID to watch just our process:

![Top displaying just one]({{ site.baseurl }}/images/posts/2023-01-11-finding-memory-leaks-with-valgrind-and-top/top-p.png)

Finding the PID each time is repetitive, so we can extract it from the process
list automatically:

{% highlight bash %}
top -p $(ps -aux | grep mem_leak | head -n 1 | awk '{print $2}')
{% endhighlight %}

Now press `E` to cycle the memory display units (KB, MB, GB). Watch the `RES`
column — if it's growing over time, you have a leak.

![Top displaying different memory format]({{ site.baseurl }}/images/posts/2023-01-11-finding-memory-leaks-with-valgrind-and-top/top-p-e.png)

`Top` confirms a leak exists, but it can't tell you where in the code it is.
That's where `Valgrind` comes in.

---

## [Pinpointing the Leak with Valgrind](#pinpointing-the-leak-with-valgrind)

`Valgrind` instruments your binary at runtime to track every allocation and
deallocation. Its default tool, `memcheck`, reports what was allocated but never
freed.

There are two levels of detail. Running `valgrind` on its own gives you a
summary — how many bytes leaked:

{% highlight bash %}
valgrind ./mem_leak missing_delete
{% endhighlight %}

![Valgrind displaying memory leak]({{ site.baseurl }}/images/posts/2023-01-11-finding-memory-leaks-with-valgrind-and-top/valgrind.png)

Running with `--leak-check=full` reveals the exact file and line where the
leaked memory was allocated, plus the stack trace:

{% highlight bash %}
valgrind --leak-check=full ./mem_leak missing_delete
{% endhighlight %}

![Valgrind displaying culprit and stack trace]({{ site.baseurl }}/images/posts/2023-01-11-finding-memory-leaks-with-valgrind-and-top/valgrind-leak-check.png)

After fixing the leak, running `Valgrind` again displays the happy news:

![Valgrind no leaks]({{ site.baseurl }}/images/posts/2023-01-11-finding-memory-leaks-with-valgrind-and-top/valgrind-no-leak.png)

### [Reading the Output](#reading-the-output)

The key sections to look at:

{% highlight bash %}
==12345== HEAP SUMMARY:
==12345==   in use at exit: 1,025 bytes in 1 blocks
==12345==   total heap usage: 2 allocs, 1 frees, ...
{% endhighlight %}

- `in use at exit`: memory that was allocated but never freed before the program ended
- `total heap usage`: if `allocs` > `frees`, something wasn't cleaned up
- `definitely lost`: Valgrind is certain this memory is unreachable. This is a real leak
- `indirectly lost`: lost because a pointer to it was itself lost (e.g. a struct that held a pointer)
- `possibly lost`: Valgrind isn't sure. Might be a leak, might be an unusual pointer pattern
- `still reachable`: technically not freed, but a pointer to it still exists at exit (often not a real problem, e.g. global singletons)

The stack trace under `definitely lost` is the gold — it shows the exact
function and line that allocated the leaked memory.

---

## [Common Leak Patterns](#common-leak-patterns)

Once `Valgrind` points you to a line, you still need to understand *why* it
leaked. These are the patterns that come up over and over.

### [Missing `delete` — The Obvious One](#missing-delete--the-obvious-one)

The simplest case. You `new` something and never free it:

{% highlight cpp %}
// Leak
int main() {
    bool* arr = new bool[1025];
    // ... use arr ...
    return EXIT_SUCCESS;  // arr leaked — no delete[]
}
{% endhighlight %}

{% highlight cpp %}
// Fix — just add the matching delete
int main() {
    bool* arr = new bool[1025];
    // ... use arr ...
    delete[] arr;
    return EXIT_SUCCESS;
}
{% endhighlight %}

**Prevention:** Prefer `std::unique_ptr` or `std::make_unique` — the destructor
handles cleanup automatically:

{% highlight cpp %}
auto arr = std::make_unique<bool[]>(1025);
// ... use arr.get() ...
// unique_ptr frees on scope exit
{% endhighlight %}

---

### [Lost Pointers — Reassignment Without Freeing](#lost-pointers--reassignment-without-freeing)

You overwrite a pointer with a new allocation, and the old one becomes
unreachable:

{% highlight cpp %}
// Leak — original 256 bytes are orphaned
char* buffer = new char[256];
buffer = new char[512];   // old pointer is gone
delete[] buffer;           // only frees the 512 allocation
{% endhighlight %}

{% highlight cpp %}
// Fix — free before reassigning
char* buffer = new char[256];
delete[] buffer;
buffer = new char[512];
// ...
delete[] buffer;
{% endhighlight %}

**Prevention:** Reassigning a `unique_ptr` automatically frees the previous
value:

{% highlight cpp %}
auto buffer = std::make_unique<char[]>(256);
// old allocation freed automatically
buffer = std::make_unique<char[]>(512);
{% endhighlight %}

---

### [Early Return in Error Paths](#early-return-in-error-paths)

The allocation and the `delete` are both there, but an early return skips the
cleanup. This one is sneaky because the happy path looks correct:

{% highlight cpp %}
// Leak — if fopen fails, buffer is never freed
bool processFile(const std::string& filename) {
    char* buffer = new char[4096];
    FILE* file = fopen(filename.c_str(), "r");

    if (!file) {
        return false;  // buffer leaked!
    }

    // ... process file ...
    delete[] buffer;
    fclose(file);
    return true;
}
{% endhighlight %}

{% highlight cpp %}
// Fix — RAII ensures cleanup regardless of return path
bool processFile(const std::string& filename) {
    auto buffer = std::make_unique<char[]>(4096);
    FILE* file = fopen(filename.c_str(), "r");

    if (!file) {
        return false;  // unique_ptr cleans up automatically
    }

    // ... process file ...
    fclose(file);
    return true;
}
{% endhighlight %}

**Prevention:** This is the strongest argument for RAII and smart pointers —
they handle every exit path, not just the one you remembered.

---

### [Containers of Raw Pointers](#containers-of-raw-pointers)

`std::vector::clear()` destroys the *pointers*, not what they point to. The
objects are leaked:

{% highlight cpp %}
// Leak — clear() removes the pointers but doesn't delete the objects
std::vector<Widget*> widgets;
widgets.push_back(new Widget());
widgets.push_back(new Widget());
widgets.push_back(new Widget());
widgets.clear();  // 3 Widgets leaked
{% endhighlight %}

{% highlight cpp %}
// Fix — manually delete before clearing
for (auto* w : widgets) {
    delete w;
}
widgets.clear();
{% endhighlight %}

**Prevention:** Use `std::vector<std::unique_ptr<Widget>>` — the smart pointers
free the objects when the vector is cleared or goes out of scope:

{% highlight cpp %}
std::vector<std::unique_ptr<Widget>> widgets;
widgets.push_back(std::make_unique<Widget>());
widgets.push_back(std::make_unique<Widget>());
widgets.clear();  // all Widgets freed automatically
{% endhighlight %}

---

### [Circular References with `shared_ptr`](#circular-references-with-shared_ptr)

Smart pointers don't eliminate leaks entirely. If two `shared_ptr`s point at
each other, neither reference count ever reaches zero:

{% highlight cpp %}
// Leak — A and B keep each other alive forever
struct Node {
    std::shared_ptr<Node> next;
};

auto a = std::make_shared<Node>();
auto b = std::make_shared<Node>();
a->next = b;
b->next = a;  // circular reference — neither is ever freed
{% endhighlight %}

{% highlight cpp %}
// Fix — break the cycle with weak_ptr
struct Node {
    std::weak_ptr<Node> next;  // doesn't contribute to reference count
};
{% endhighlight %}

**Prevention:** Use `std::weak_ptr` for back-references or any relationship
that shouldn't keep the object alive.

---

`Valgrind` catches all of these. The pattern doesn't change — run
`valgrind --leak-check=full`, read the stack trace, find the allocation, figure
out which category it falls into, and apply the fix.

---

## [Caveats and Tips](#caveats-and-tips)

- **Compile with `-g`**: `Valgrind` needs debug symbols to show file names and line numbers in stack traces. Without `-g`, you get hex addresses instead.
- **Valgrind is slow**: it instruments every memory access, so programs run 10-50x slower. Use small inputs when profiling.
- **Linux-first**: `Valgrind` works best on Linux. macOS support is limited and lags behind. On macOS, consider running in a Docker container or Linux VM.
- **Suppression files**: third-party libraries (OpenGL drivers, system libs) sometimes have "leaks" that aren't your fault. `Valgrind` suppression files let you ignore these so you can focus on your own code.
- **Alternative — AddressSanitizer**: compile with `-fsanitize=address` (Clang/GCC) for a lighter-weight option that's faster than `Valgrind` but catches fewer issues. Good for CI.

---

{% include callout.html
    content ="Check out the [companion playground on GitHub](https://github.com/tessapower/mem-leak-playground) — it has runnable examples of each leak pattern, ready for `Valgrind`."
    type="primary" %}
