---
title: "Fasten your seatbelts — repurposing custom iterators as generators"
layout: post
tags: [c++, iterators, generators, computer vision, backtracking]
---
In this post, I'm going to show you a slightly unusual use case for a custom 
iterator that I repurposeed as a generator to represent geometric properties.

It all started with an interesting computer vision problem: given a scan of 
clothing fasteners, identify and highlight the broken fasteners by placing a 
red box around them.

![Scan of Fasteners]({{ site.baseurl }}/assets/posts/2021-10-21-fasten-your-seatbelts/scan.png)

We're told that a good fastener needs to be round, have no obviously broken
edges, and exactly four interior holes (apparently this is not a very fancy
fastener factory).

### [Finding the Fasteners](#finding-the-fasteners)

While the fancy approach involves training a neural network, using a 
backtracking algorithm to find the fasteners within the scan is relatively 
simple.

![Backtracking]({{ site.baseurl }}/assets/posts/2021-10-21-fasten-your-seatbelts/backtrack.png)

This is a pretty standard "finding islands within islands" problem, so I won't 
go into detail about how we found the fasteners (though if you're curious, you 
can [check out the full project on GitHub](#)).

Backtracking algorithms are very simple at their core but, as you probably
already know, they start to get messy when we include tests. So we're going to
separate out these two concerns, finding and assessing the fasteners. This is
our working state once we've found all the fasteners by their bounds:
<!--more-->

![Found Fasteners]({{ site.baseurl }}/assets/posts/2021-10-21-fasten-your-seatbelts/found-fasteners.png)

So how can we tell the good from the bad?

---

### [The Good, the Bad, and the Ugly](#the-good-the-bad-and-the-ugly)

As you can see, we need to take into account that fasteners may not necessarily 
be the same size, color, or perfectly round. But we can take advantage of the
good fasteners essentially being circles, with well-defined and known geometric
properties.

Ignoring the number of holes requirement for now, we'll first test for broken 
edges. The scan is too pixelated to test fasteners against a perfect circle, 
but we can test if they're _roughly_ circular. So given the origin and radius 
from the bounds, we can create two concentric circles and expect the fastener 
to fall between them.

Our two concentric circles will be slighty smaller and larger than the bounds:

```cpp
const int radius = static_cast<int>(std::max(bounds.width(), bounds.height()) / 2.0);

const Circle outer{bounds.center(), static_cast<int>(radius * 1.2)};
const Circle inner{bounds.center(), static_cast<int>(radius * 0.9)};
```

Which end up looking like this:

![Concentric circles of test points]({{ site.baseurl }}/assets/posts/2021-10-21-fasten-your-seatbelts/good-test-points.png) ![Concentric circles of test points]({{ site.baseurl }}/assets/posts/2021-10-21-fasten-your-seatbelts/bad-test-points.png)

Our goal is to test that all points on the outer circumference are _not_ part 
of the fastener, and all points on the inner circumference _are_ part of the 
fastener.

So given the radius of a circle, how do we test all points on its circumference?

#### [Testing for "roughly circularness"](#testing-for-roughly-circularness)

An initial approach could be to first calculate all of the points on the
circumference, store them in a suitable data structure, and then verify that 
each point satisfies the right condition.

To calculate the points on the circumference, we'll use [Bresenham's circle 
algorithm](https://en.wikipedia.org/wiki/Midpoint_circle_algorithm) and 
calculate all the reflected points based on the coordinates from one octant.

![Found Fasteners]({{ site.baseurl }}/assets/posts/2021-10-21-fasten-your-seatbelts/first-octant.png)

Ideally, we'd be able to iterate over the points like this:

```cpp
  bool is_broken = std::any_of(circumference.begin(), 
                               circumference.end(), 
                               some_test);
  // OR
  for (auto point : circumference) {
    // do the thing
  }
```

But instead of using a data structure, **we're going to create a custom
iterator class and repurpose it as a generator that returns the next point on the 
the circumference on-the-fly.** It's a slightly out of the box idea, to 
represent a geometric property of a circle with an iterator, but I think the 
results will speak for themselves!

---

### [Custom iterators as generators](#custom-iterators-as-generators)

We don't need to do anything out of the ordinary to define our custom iterator,
which we'll call our `CircumferenceIterator`. We only need to add the usual 
(C++17) iterator traits and `begin()` and `end()` so it will play nice with STL
algorithms that work on ranges.

#### [A first pass with the first octant](#a-first-pass-with-the-first-octant)

For our `CircumferenceIterator` to act as a generator, we need to pay attention
to the dereference and increment operators.

The derefence operator will do most of the heavy lifting—it will return the 
next point while taking the current octant into account, which we'll keep track
of at the class instance level.

Here's what it would look like if we were only generating points for **one** 
octant using Bresenham's circle algorithm:

```cpp
Point CircumferenceIterator::operator*() const {
  const int r = circle.get_radius();
  const int dy = (int)sqrt(pow(r, 2) - pow(dx, 2));

  Point const &origin = circle.get_origin();
  return Point{origin.get_x() + dx, origin.get_y() + dy};
}

CircumferenceIterator CircumferenceIterator::operator++() {
  dx += 1;

  return *this;
}

CircumferenceIterator CircumferenceIterator::begin() const {
  return CircumferenceIterator{circle, 0};
}

CircumferenceIterator CircumferenceIterator::end() const {
  const int end_dx = static_cast<int>(circle.get_radius() / sqrt(2) + 1);
  return CircumferenceIterator{circle, end_dx};
}
```

#### [Jumping from octant to octant](#jumping-from-octant-to-octant)

To make this work for all octants, we could finish one octant entirely before 
moving on to the next, but instead we're going to calculate all the reflected 
points for the current `x` coordinate in all eight octants like so: 

![Jumping Octants]({{ site.baseurl }}/assets/posts/2021-10-21-fasten-your-seatbelts/octant-jump-gif.png)

The reason for doing this is that it has a neat effect on efficiency! Keeping 
our goal in mind to test points on the circumference, we want to stop as soon 
as we find any point that doesn't satisfy the condition. We can speed this up a 
lot by jumping from octant to octant. It's easy to see where the increase in 
speed comes from with broken fasteners like the one above.

Taking all eight octants into account, our dereference and increment operators 
now look like this:

```cpp
Point CircumferenceIterator::operator*() const {
  const int r = circle.get_radius();
  const int dy = (int)sqrt(pow(r, 2) - pow(dx, 2));

  Point const &origin = circle.get_origin();
  switch (octant) {
  case 0:
    return Point{origin.get_x() + dx, origin.get_y() + dy};
  case 1:
    return Point{origin.get_x() + dx, origin.get_y() - dy};
  case 2:
    return Point{origin.get_x() - dx, origin.get_y() + dy};
  case 3:
    return Point{origin.get_x() - dx, origin.get_y() - dy};
  case 4:
    return Point{origin.get_x() + dy, origin.get_y() + dx};
  case 5:
    return Point{origin.get_x() + dy, origin.get_y() - dx};
  case 6:
    return Point{origin.get_x() - dy, origin.get_y() + dx};
  case 7:
    return Point{origin.get_x() - dy, origin.get_y() - dx};
  default:
    assert(false);
  }
}

CircumferenceIterator CircumferenceIterator::operator++() {
  if ((++octant %= 8) == 0) {
    ++dx;
  }

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

Checking that each fastener is roughly circular now looks super clear and very
readable thanks to `std::any_of` and a few predicate functions:

```cpp
bool is_broken = false;

is_broken |= std::any_of(outer_circumference.begin(),
                         outer_circumference.end(), 
                         img::is_part_of_fastener);

is_broken |= std::any_of(inner_circumference.begin(), 
                         inner_circumference.end(),
                         img::is_not_part_of_fastener);
```

Coming back to the number of fastener holes, we'll use another backtracking 
algorithm that returns the number and check that against our requirements:

```cpp
is_broken |= alg::discover_num_holes(inner.bounding_box()) != 
             kNumRequiredHoles;
```

You might find it interesting to visualize what our backtracking algorithms are 
discovering, and the concentric circles that are being tested:

![Found Fasteners]({{ site.baseurl }}/assets/posts/2021-10-21-fasten-your-seatbelts/backtracking-visualization.png)

We can go ahead and apply the same concepts as above to draw the red box
around a broken fastener—by creating a `PerimiterIterator` for the bounds, we
can now do this:

```cpp
if (is_broken) {
  for (auto const &point : bounds.perimeter()) {
    img::draw_point(point, geom::Color::Red());
  }
}
```

**And here's the final result of all of our hard work:**

![Result]({{ site.baseurl }}/assets/posts/2021-10-21-fasten-your-seatbelts/result.png)

---

### [The outcome](#the-outcome)

This was just a small part of the larger project of many classes and multiple 
namespaces! Like I mentioned before, backtracking algorithms are very simple at 
their core, and they usually get complicated when they're riddled with tests. 
This was going to be especially true, considering we have backtracking within
backtracking! With around 100 lines of code, we managed to reduce the overall
complexity of our backtracking and bring some clarity to what we're doing.

Although it's an unusual application of an iterator, I think the results really
do speak for themselves! With a bit of out-of-the-box thinking, we were able to 
represent geometric properties by building iterators from primitives that plug 
straight into STL algorithms, and create fantastically readable code that 
expresses succinctly what we were trying to achieve.

Below is the culmination of our work in this post in the function to process a 
scan. I'd highly recommend checking out the entire project to fully appreciate
the approach!

```cpp
void alg::process_scan() {
  for (auto const &bounds : alg::discover_all_fastener_bounds()) {
    bool is_broken = false;

    // Draw two concentric circles and require that the pixelated edge of the
    // fastener falls between them.
    const int radius =
        static_cast<int>(std::max(bounds.width(), bounds.height()) / 2.0);

    const geom::Circle outer{bounds.center(), static_cast<int>(radius * 1.2)};
    const geom::Circle inner{bounds.center(), static_cast<int>(radius * 0.9)};

    auto outer_circumference = outer.circumference();
    auto inner_circumference = inner.circumference();

    is_broken |= std::any_of(outer_circumference.begin(),
                             outer_circumference.end(), 
                             img::is_part_of_fastener);

    is_broken |= std::any_of(inner_circumference.begin(), 
                             inner_circumference.end(),
                             img::is_not_part_of_fastener);

    is_broken |= alg::discover_num_holes(inner.bounding_box()) != 
                 kNumRequiredHoles;

    if (is_broken) {
      for (auto const &point : bounds.perimeter()) {
        img::draw_point(point, geom::Color::Red());
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
project to discover the fasteners and the number of holes.

