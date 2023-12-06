---
title: "Repurposing custom iterators as generators"
layout: post
tags: [c++, iterators, generators, computer vision, backtracking]
---
In this post, I'm going to cover a slightly unusual use case for a custom
C++ iterator that I repurposeed as a generator to represent the geometric
properties of circles. This is a small part of a larger project that I worked on
recently, which involved using backtracking algorithms to find and assess the
quality of buttons in a 2D scan.

### [Motivation](#motivation)

The idea to repurpose a custom iterator as a generator evolved while working on
an interesting computer vision problem: given a basic black and white 2D scan of
clothing buttons, identify and highlight the broken buttons by placing a red box
around them. We can easily understand how useful this would be on a factory
production line to help automate quality control, so our motivation is clear.

![Scan of Buttons]({{ site.baseurl }}/images/posts/2021-10-21-custom-iterators-as-generators/scan.png)

We're given the criteria for a button that passes the quality control test:

- Round shape;
- No obviously broken edges;
- Exactly four interior holes (apparently this is a very boring
button factory).

TODO: Add image of good button vs. button with broken edges vs. button with too
many holes or not enough holes.

### [Use of Backtracking](#use-of-backtracking)

We could make use of modern techniques to find the buttons, such as training a
neural network, however using a backtracking algorithm is relatively simple and
arguably quicker to implement.

![Backtracking]({{ site.baseurl }}/images/posts/2021-10-21-custom-iterators-as-generators/backtrack.png)

Backtracking algorithms are very simple at their core but, as you probably
already know, they start to get messy when we include tests. Because we need to
assess the button quality as well as finding them in the first place, we're
going to separate out these concerns in distinct passes.

### [Finding the buttons](#finding-the-buttons)

This is a pretty standard "finding islands within islands" problem, so I won't
go into detail about how we found the buttons (though if you're curious, you
can [check out the full project on GitHub](https://github.com/tessapower/backtracking-buttons)).
This is our working state once we've found all the buttons by their bounding
boxes:
<!--more-->

![Found Buttons]({{ site.baseurl }}/images/posts/2021-10-21-custom-iterators-as-generators/found-buttons.png)

Now we can move on to assessing them.

---

### [Assessing the buttons](#assessing-the-buttons)

Ignoring the number of holes requirement for now, we'll first test for broken
edges. As you can see from the scans, we need to take into account that buttons
may not necessarily be the exact same size, color, or be perfectly round.

Since we know the bounds of each button, we can test for broken edges by taking
advantage of good buttons essentially being circles, with well-defined and
known geometric properties. The scan is too pixelated to test buttons against a
perfect circle, but we can test if they're _roughly_ circular. So given the
origin and radius from the bounds, we can create two concentric circles and
expect the button to fall somewhere between them.

Our two concentric circles will be slighty smaller and larger than the bounds:

```cpp
const int radius = static_cast<int>(std::max(bounds.width(), bounds.height()) / 2.0);

const Circle outer{bounds.center(), static_cast<int>(radius * 1.2)};
const Circle inner{bounds.center(), static_cast<int>(radius * 0.9)};
```

{% include callout.html
    content ="Some code examples in this post have been simplified for clarity and may differ from the [final result found on GitHub](https://github.com/tessapower/backtracking-buttons)."
    type="note" %}

Which ends up looking like this:

![Concentric circles of test points]({{ site.baseurl }}/images/posts/2021-10-21-custom-iterators-as-generators/good-test-points.png) ![Concentric circles of test points]({{ site.baseurl }}/images/posts/2021-10-21-custom-iterators-as-generators/bad-test-points.png)

Our goal is to test that all points on the outer circumference are _not_ part
of the button, and all points on the inner circumference _are_ part of the
button.

So given the radius of a circle, how do we test all points on its circumference?

#### [Testing for "roughly circularness"](#testing-for-roughly-circularness)

Our initial approach will be to first calculate all of the points on the
circumference, then store them in a suitable data structure, and finally verify
that each point satisfies the right condition.

Technically, a circle has an infinite number of points on its circumference,
but that doesn't translate well into code, so instead we'll calculate the points
using [Bresenham's circle algorithm](https://en.wikipedia.org/wiki/Midpoint_circle_algorithm). This algorithm results in a finite number of
points on the circumference at fixed intervals for a single octant. These points
can then simply be reflected across the x and y axes appropriately to generate
the other seven octants.

![Found Buttons]({{ site.baseurl }}/images/posts/2021-10-21-custom-iterators-as-generators/first-octant.png)

So now that we have our circumference points, we would ideally iterate
over them and test each point against our condition:

```cpp
  bool is_broken = std::any_of(circumference.begin(),
                               circumference.end(),
                               some_test);
  // OR
  for (auto point : circumference) {
    // do the thing
  }
```

There are a few problems with this approach:

1. We need to store all of the circumference points in memory;
2. We need to do this for both the inner and outer circumferences;
3. We need to do this for every button.

You can see how this would quickly become a problem and very wasteful,
especially if we're processing a large number of buttons. So instead of storing
all the points in memory, we're going to create a custom iterator class called
`CircumferenceIterator` and **repurpose it as a circumference point generator.**

---

### [Custom iterators as generators](#custom-iterators-as-generators)

The `CircumferenceIterator` will function as you would normally expect a
forward iterator to, but instead of returning the next point on the
circumference by referencing it's location in memory in some data
structure, we will be generating it _on-the-fly_. It's a slightly out of the box
idea, to represent a geometric property of a circle with an iterator, but I
think the results will speak for themselves!

We don't need to do anything out of the ordinary to define our custom iterator.
We only need to add the usual (`C++17`) iterator traits and `begin()` and
`end()` so it will play nice with STL algorithms that work on `std::ranges`.

Given a specific `Circle` instance, we create a `CircumferenceIterator` such
that we have access to the geometric properties of the circle needed to generate
the next point on the circumference:

```cpp
  /**
    * @brief Construct a CircumferenceIterator for a given Circle.
    *
    * @param c The Circle to generate points for.
    * @param dx The x coordinate of the first point on the circumference.
    */
  constexpr CircumferenceIterator(Circle const &c, int dx) noexcept
      : circle{c}, dx{dx}, radius{c.get_radius()},
        origin_x{c.get_origin().get_x()}, origin_y{c.get_origin().get_y()} {};
```

You may have been thinking, _"why not calculate the position of a point on the
circumference and then immediately assess it?"_, and you'd be right! That's
exactly what repurposing an iterator as a generator will allow us to do, and
we're going to do it in a way that's more efficient and readable than the naïve
approach above.

#### [A first pass with the first octant](#a-first-pass-with-the-first-octant)

For our `CircumferenceIterator` to act as a generator, we need to customize the
dereference and increment operators while keeping track of the current octant at
the class instance level. The dereference operator will do most of the heavy
lifting—it will return the next point taking the current octant into account.

Here's what it would look like if we were only generating points for **one**
octant using Bresenham's circle algorithm:

```cpp
/// Dereference the iterator to get the next point on the circumference.
Point CircumferenceIterator::operator*() const {
  const int dy = (int)sqrt(pow(radius, 2) - pow(dx, 2));

  return Point{origin_x + dx, origin_y + dy};
}

/// Increment the iterator to the next point on the circumference.
CircumferenceIterator CircumferenceIterator::operator++() {
  dx += 1;

  return *this;
}

/// Begin the iterator at the first point on the circumference.
CircumferenceIterator CircumferenceIterator::begin() const {
  return CircumferenceIterator{circle, 0};
}

/// End the iterator at one past the last point on the circumference.
CircumferenceIterator CircumferenceIterator::end() const {
  const int end_dx = static_cast<int>(circle.get_radius() / sqrt(2) + 1);

  return CircumferenceIterator{circle, end_dx};
}
```

#### [Jumping from octant to octant](#jumping-from-octant-to-octant)

Naturally, our first approach would involve testing all points in one octant
to completion before moving on to the next, but instead we're going to calculate
all the **reflected points** for the current `x` coordinate in all eight octants,
like so:

![Jumping Octants]({{ site.baseurl }}/images/posts/2021-10-21-custom-iterators-as-generators/octant-jump-gif.png)

Doing this has a neat effect on efficiency! Keeping our goal in mind to test
points on the circumference, we want to stop as soon as we find any point that
doesn't satisfy the condition. We can test more effectively by jumping from
octant to octant and covering a larger area of the button in a shorter amount
of time. It's easy to see where the increase in speed comes from with broken
buttons like the one above.

Taking all eight octants into account, our dereference and increment operators
now look like this:

```cpp
Point CircumferenceIterator::operator*() const {
  const int dy = (int)sqrt(pow(r, 2) - pow(dx, 2));

  switch (octant) {
  case 0: return Point{origin_x + dx, origin_y + dy};
  case 1: return Point{origin_x + dx, origin_y - dy};
  case 2: return Point{origin_x - dx, origin_y + dy};
  case 3: return Point{origin_x - dx, origin_y - dy};
  case 4: return Point{origin_x + dy, origin_y + dx};
  case 5: return Point{origin_x + dy, origin_y - dx};
  case 6: return Point{origin_x - dy, origin_y + dx};
  case 7: return Point{origin_x - dy, origin_y - dx};
  default: assert(false); // Impossible situation
  }
}

CircumferenceIterator CircumferenceIterator::operator++() {
  if ((++octant %= 8) == 0) ++dx;

  return *this;
}

// begin() and end() remain the same
```

Now we get to the cool part, seeing how it all comes together!

---

### [Plugging into STL algorithms](#plugging-into-stl-algorithms)

It turns out that representing a geometric property like the points on a
circumference with an iterator-turned-generator works quite well! We can now
plug straight into STL algorithms, and most importantly keep our backtracking
algorithms succinct and free from tests.

Checking that each button is roughly circular now looks super clear and very
readable thanks to `std::any_of` and a few predicate functions:

```cpp
bool is_broken = false;

// Test the points on the outer circumference.
is_broken |= std::any_of(outer_circumference.begin(),
                         outer_circumference.end(),
                         is_part_of_fastener);

// Test the points on the inner circumference.
is_broken |= std::any_of(inner_circumference.begin(),
                         inner_circumference.end(),
                         is_not_part_of_fastener);
```

Now coming back to the requirement for the number of button holes, we'll use
another backtracking algorithm to locate the interior holes of each button and
check that against our requirements:

```cpp
is_broken |= discover_num_holes(inner.bounding_box()) != kNumRequiredHoles;
```

You might find it interesting to visualize what the backtracking algorithms are
discovering, and the concentric circles that are being tested:

![Found Buttons]({{ site.baseurl }}/images/posts/2021-10-21-custom-iterators-as-generators/backtracking-visualization.png)

A logical next step is to apply the same concepts as above to drawing the red
box to highlight a broken button with a `PerimiterIterator` for the bounding
box. So now we can do the following:

```cpp
if (is_broken) {
  for (auto const &point : bounds.perimeter()) {
    draw_point(point, Color::Red());
  }
}
```

**And here's the final result of all of our hard work:**

![Result]({{ site.baseurl }}/images/posts/2021-10-21-custom-iterators-as-generators/result.png)

---

### [The outcome](#the-outcome)

This was just a small part of the larger project of many classes and multiple
namespaces! Like I mentioned before, backtracking algorithms are very simple at
their core, and they usually get complicated when they're riddled with tests.
This was going to be especially true, considering we are performing backtracking
within backtracking! With around 100 lines of code, we managed to reduce the
overall complexity of our algorithms and bring some clarity to what we're doing.

Although it's a not a conventional application for an iterator, I thought it was
novel enough to be worth sharing! With a bit of out-of-the-box thinking, we were
able to represent geometric properties by building iterators from primitives
that plug straight into STL algorithms, and create fantastically readable code
that expresses succinctly what we were trying to achieve.

Below is the culmination of our work in this post in the function to process a
scan. I'd highly recommend checking out the entire project to fully appreciate
the approach!

```cpp
void alg::process_scan() {
  for (auto const &bounds : discover_all_fastener_bounds()) {
    bool is_broken = false;

    // Draw two concentric circles and require that the pixelated edge of the
    // button falls between them.
    const int radius =
        static_cast<int>(std::max(bounds.width(), bounds.height()) / 2.0);

    const geom::Circle outer{bounds.center(), static_cast<int>(radius * 1.2)};
    const geom::Circle inner{bounds.center(), static_cast<int>(radius * 0.9)};

    auto outer_circumference = outer.circumference();
    auto inner_circumference = inner.circumference();

    is_broken |= std::any_of(outer_circumference.begin(),
                             outer_circumference.end(),
                             is_part_of_fastener);

    is_broken |= std::any_of(inner_circumference.begin(),
                             inner_circumference.end(),
                             is_not_part_of_fastener);

    is_broken |= discover_num_holes(inner.bounding_box()) !=
                 kNumRequiredHoles;

    if (is_broken) {
      for (auto const &point : bounds.perimeter()) {
        draw_point(point, Color::Red());
      }
    }
  }
}
```

{% include callout.html
    content ="Check out the [repo on GitHub](https://www.github.com/tessapower/)!"
    type="primary" %}

---

### What's next?

In my next post, I'm going to visualize the backtracking algorithm used in this
project to discover the buttons and the number of holes.

