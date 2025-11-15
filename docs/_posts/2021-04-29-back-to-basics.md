---
title: "Back to basics: using GoogleTest without CMake for C++ projects"
layout: post
tags: [ c++, gtest, googletest, cmake ]
---

In this post, I'm going to explain how I went back to basics and used
[GoogleTest](https://google.github.io/googletest/) as a standalone library
without CMake for small-scale C++ projects.

## Table of Contents

- [GoogleTest](#googletest)
- [Manually Linking against GoogleTest](#manually-linking-against-googletest)
- [Stuff that didn't go to plan](#stuff-that-didnt-go-to-plan)
  - [ `-pthread` vs. `-lpthread`](#--pthread-vs--lpthread)

---

## [GoogleTest](#GoogleTest)

GoogleTest (or GTest) is Google's testing and mocking framework for C++. GTest
can be used for any kind of tests, not just unit tests, and has some nice
features like automatically detecting tests and playing nicely with your IDE.
It's generally used with a build system like CMake or Bazel.

You might think I'm a masochist for foregoing a standard setup in favour of
programming in VIM and manually linking. Why go back to the basics?
<!--more-->
It's *good* to do things the hard way sometimes and good practice to remember
the basics. As a minimalist approach, it also works really well for small-scale
projects like the ones I complete for my BSc.

Using the terminal and nothing else, I can avoid the overhead of an IDE and
CMake, and as a nice bonus, my directories are decluttered of IDE files.
(This is what I do for "fun", in the workplace I play by the rules and use all
the tools!)

## [Manually Linking against GoogleTest](#setup-run-googletest)

To manually link against the test framework and produce a test executable that
can be run from the command line, do the following:

1. The library needs to be in place to link against it, so first install the
   `libtest-dev` package:

  ```zsh
  sudo apt install libgtest-dev
  ```

2. Write the tests, and include the header `<gtest/gtest.h>` in the test
   files.
3. Compile the tests and link against `-lgtest`, and `-lgtest_main`:

```zsh
clang++ -pthread **/*.cc -lgtest -lgtest_main && ./a.out
```

Here's what it looks like when it runs:

![Running GTest]({{ site.baseurl }}/images/posts/2021-04-29-back-to-basics/running-gtest.gif)

The result is a minimalist one-liner with all the niceties of GTest and no
extra overhead.

## [Stuff that didn't go to plan](#stuff-that-didnt-go-to-plan)

When I first tried to compile the tests, I ran the command without `-pthread`:

```zsh
clang++ **/*.cc -lgtest -lgtest_main && ./a.out
```
This resulted in linker errors and warnings about undefined references to
`pthread` methods. GTest requires Pthreads to compile, so it seemed like I need
to link against the pthreads library. The internet disagreed, however, on
whether to use `-lpthread` or the compiler command line option `-pthread`.

After some digging, I discovered that clang compilers require using `-pthread`
to both compile and link POSIX-compliant multi-threaded applications. On top of
that, Linux machines should also make use of `-pthread`, according to the
[Linux man pages](https://man7.org/linux/man-pages/man7/pthreads.7.html).

### [ `-pthread` vs. `-lpthread`](#lpthread-vs-pthread)

I went down the rabbit hole to discover the difference between `-pthread` and
`lpthread`. Here's what I learned:

- The `-pthread` option sets flags for both the compiler preprocessor *and* linker.
  - At *compile time*, `-pthread` manifests that the Pthread API is requested
    and defines platform-specific macros, such as `_REENTRANT` on Linux.
  - At *link time*, the linker will specifically link the resultant object
    against libpthread.

- In comparison, `-lpthread` will only do the _second part_, i.e. linking against
  libpthread.

Had I not manually linked against GTest, I would not have discovered this,
which proves that it's always a good idea to go back to the basics every now
and then!

---

