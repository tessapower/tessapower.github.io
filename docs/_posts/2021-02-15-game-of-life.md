---
title: "Cellular Automata—a JavaScript implementation of Conway's Game of Life"
layout: post
tags: [js, html, book]
---

I took a short detour from C++ to learn Javascript by working through the book [Eloquent Javascript](https://amzn.to/2LMjeuY). It's a delightful, well written book that introduces the language and offers exercises at the end of each chapter—one of the more interesting exercises was implementing **Conway's Game of Life**.

## Table of Contents
{:.no_toc}

* TOC
{:toc}

---

## [What is Life?](#what-is-life)

[Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) (or simply *Life* ) is a well-known cellular automaton created by mathematician John Conway. Life is played on an infinitely large grid of square *cells*—each cell can be either *alive* or *dead*.

An alive cell is shown by putting a marker on its square, like this:
<!--more-->

![Neighborhood]({{ site.baseurl }}/images/posts/2021-02-15-game-of-life/neighborhood.svg)

Each cell has eight neighbours, which are the cells that are found horizontal, vertical, or diagonal to the cell:

![Neighbors]({{ site.baseurl }}/images/posts/2021-02-15-game-of-life/neighbors.svg)

Life is a zero-player game, which means that you can set the initial configuration and watch how it evolves over time—the game doesn't need any further user input.

### The rules

Conway actually wrote **four** rules for Life, but they can be condensed into these **three**:

1. Any **alive** cell with two or three alive neighbors survives.
<br>![Rule 1]({{ site.baseurl }}/images/posts/2021-02-15-game-of-life/rule-1.svg)
2. Any **alive** cell with less than two or more than three alive neighbors dies (isolation or overpopulation).
<br>![Rule 2]({{ site.baseurl }}/images/posts/2021-02-15-game-of-life/rule-2.svg)
3. Any **dead** cell with three alive neighbors becomes an alive cell.
<br>![Rule 3]({{ site.baseurl }}/images/posts/2021-02-15-game-of-life/rule-3.svg)

At each tick, a new generation is created by counting the number of alive neighbors each cell has and applying the rules to every cell simulataneously in the grid.

{% include important.html
    content="The number of alive neighbors is always based on the cells *before* the rule was applied." %}

---

## [The exercise](#the-exercise)

For this exercise, I needed to display a table of checkbox fields on a webpage, with buttons to advance to the next generation and to run the game automatically. If the user checks or unchecks the checkboxes, their changes should be included when computing the next generation.

As the exercise called for an HTML table, showing the next generation on the page involved first computing internally what the state of each cell should be and then replacing the checkboxes in the table on the page. A nice feature of JS was being able to eloquently pass on the location of the checkbox that a user had clicked to a closure function. This closure function then updated the state of the cell that it corresponded to internally, which allowed the user changes to be included when computing the next generation.

This implementation turned out to be pretty inefficient though, and performance was **abismal**. The HTML DOM acts as a live data structure, and rebuilding the DOM tree for every new generation proved costly.

Here it is running in the browser—I even made the checkboxes smaller so they looked more like cells:

![Game of Life with Checkboxes]({{ site.baseurl }}/images/posts/2021-02-15-game-of-life/checkbox-gol.gif)

You can see it's running pretty slowly! My poor browser was desperately trying to render more than 11,000 checkboxes in a 150x75 table each tick. The frame rate reduced to a measley 0.7 fps and my laptop sounded like it was trying to take off. Using the browser's developer tools, I could see where there were bottlenecks in my code and why it was having such a hard time. In my next post, I'll write more about these performance issues and how I went about refactoring and testing my changes.

Not only was using a table of checkboxes causing the DOM tree to rebuild more frequently than I'd like, the cool spaceships and still-lifes that make Life so interesting were difficult to recognise. I decided to go beyond what the exercise called for and use an **HTML Canvas** instead. As the canvas is a low-level procedural model backed by a bitmap—not only would it look cooler—it could simply bypass all the expensive calculations associated with the DOM.

### How Life works

Life, as we all know, comes with its challenges. To play Life, I needed to answer two questions to create each new generation:

1. What's the state of each cell? (alive or dead)
2. How many alive neighbors does each cell have?

Like all good projects, these questions lead to more questions, which we'll dive into as well.

> What's the state of each cell?

Before I could answer this question, I needed out to figure out how to best represent the grid. In this case, a 2D array made sense—thinking of the grid like a coordinate system meant that I could locate each cell with a point `(x, y)`, starting from `(0, 0)`, much like pixels on a canvas...!

![Grid Layout]({{ site.baseurl }}/images/posts/2021-02-15-game-of-life/grid-layout.svg)

To work with the grid, I first created the `Point` class—a general-use class whose constructor takes two integers `(x, y)` and returns a new `Point`. Its methods can return any of the points individual neighbors. Calling `Point.neighbors()` returns an array of the coordinates of the neighboring points, which helps to answer question number 2.

Using the `Point` class, I built up the `Grid` class—another general-use class whose constructor takes an integer width and height, and an optional default value for each entry, and returns a 2D array of that size. It has methods to get and set the value at a given `Point`, and return whether a `Grid` contains a `Point`.

Armed with a `Point` and a `Grid`, I could create the gameboard for Life!

![Grid with States]({{ site.baseurl }}/images/posts/2021-02-15-game-of-life/grid-with-states.svg)

To check the state of each cell, I also created the `GridIterator` class, which provides an interface to safely loop over each entry in a `Grid` row-by-row like this:

{% highlight js %}
// Using a for...of statement
for (let point of grid) {
  grid.setValueAt(point, "bar");
}
{% endhighlight %}

Now the function `isAlive(point, grid)` has everything it needs to return if the cell is alive or dead given a `Point` and a `Grid`.

> How many alive neighbors does each cell have?

The function `isAlive()`, along with all other gameplay specific functions, are located in `game-logic.js`. This is also where the function `numAliveNeighbors(point, grid)` lives, which takes a `Point` and a `Grid` and returns the meaning of life... *badum tss...* just kidding. It returns the number of alive neighbors around the cell at that point in the grid.

To do this, I used the `Point` method `Point.Neighbors()`. What you might have realised is that using this method on an edge or corner point will return all neighboring points—*including points outside of the grid boundaries*:

![numAliveNeighbors]({{ site.baseurl }}/images/posts/2021-02-15-game-of-life/numAliveNeighbors.svg)

To solve this issue, `numAliveNeighbors()` first checks if the grid contains the point before checking if the cell at that point is alive.

This is one of the limitations of using a 2D array to represent the grid—they can't have negative or infinite indices. The Game of Life is meant to stretch infinitely in all directions, but a computer has finite memory and I'd need a much more complex data structure to represent it.

## The Canvas

Figuring out how to answer those two questions proved to be the trickiest part—drawing on the canvas was relatively intuitive! The structure of the `Grid` meant that it was simple to draw and update cells on the canvas at their corresponding coordinates. I used [webpack](https://webpack.js.org) to bundle everything together, so you can play Life right here from my post:

{% include game-of-life.html %}

{% include callout.html
    content ="Take a look at `The Game of Life` [here](https://www.github.com/tessapower/game-of-life) on GitHub"
    type="primary" %}

---

## What's next?

Using the canvas instead of checkboxes gave Life a huge boost in performance—you can read about how I profiled and optimised the Game of Life in my next post.

---

{% include callout.html
    content ="Check out the [repo on GitHub](https://github.com/tessapower/game-of-life)!"
    type="primary" %}
