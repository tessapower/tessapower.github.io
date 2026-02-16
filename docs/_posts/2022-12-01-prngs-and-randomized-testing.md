---
title: "Pseudo-random number generators and randomized testing"
layout: post
tags: [prng, random number generation, testing, randomized testing, ruby, rspec, algorithms]
---

In this post, I'm going to cover two topics that are more connected than they
first appear: how pseudo-random number generators (PRNGs) work under the hood,
and how to use that knowledge to write better, reproducible randomized tests.
This started as a lightning talk I gave and I decided to expand it into a full
article.

{% include callout.html
    content ="If you want to skip straight to the code, check out the companion repos: [my-pseudo-rand](https://github.com/tessapower/my-pseudo-rand) and [seeded_random_tests](https://github.com/tessapower/seeded_random_tests)."
    type="info" %}

<!--more-->

## Table of Contents

{:.no_toc}

- TOC
{:toc}

---

## Part 1: How Pseudo-Random Numbers Actually Work

### [Nothing is Random](#nothing-is-random)

**The most important thing to understand is that computers are dumb machines.**

They do what they're told, and are completely deterministic.

So let's say we're programmatically placing obstacles in a game, and we want the
obstacles to be randomly placed. We need random numbers for this so we'd
look to a random number generator function. But remembering that computers are
deterministic, how could it possibly generate random numbers? Quite simply, **it
can't**.

The good news is that for most applications, we don't need true randomness —
we can get away with sequences that *look* random but are actually fully
reproducible. That's what a Pseudo-Random Number Generator (PRNG) algorithm
does. It takes a starting value (a *seed*) and produces a sequence of numbers
that appears random to us, but is entirely determined by that seed. The same
seed produces the same sequence, every time.

Deterministic randomness turns out to be incredibly useful for simulations,
games, and, the topic of the second part of this post, randomized testing.

{% include callout.html
    content ="An algorithm that generated truly random numbers needs a source of
    true randomness: thermal noise, your mouse movement, atmospheric
    fluctuations, etc. Things that are inherently unpredictable. We don't tend
    to do this in software because it's slow, complex, and often unnecessary."
    type="info" %}

---

### [Linear Congruential Generator](#linear-congruential-generator)

One of the simplest and most well-known PRNG algorithms is the Linear
Congruential Generator (LCG). The entire algorithm is a single formula:

$$X_{n+1} = (a \cdot X_n + c) \bmod m$$

where:

- `m` — the *modulus*, which sets the upper bound of the range (0 to m-1)
- `a` — the *multiplier*, introduces chaos into the calculation
- `c` — the *increment*, shifts the sequence
- `X₀` — the *seed*, the starting value that determines the entire sequence

That's it! Three parameters and a seed. Given any term in the sequence, we can
always calculate the next one.

#### [LCG Example Output](#lcg-example-output)

Let's use small values to see a LCG in action. With `a = 5`, `c = 3`, `m = 16`,
and seed `X₀ = 7`:

| Step | Calculation         | Result |
|:----:|:-------------------:|:------:|
| X₁   | (5 × 7 + 3) mod 16  | 6      |
| X₂   | (5 × 6 + 3) mod 16  | 1      |
| X₃   | (5 × 1 + 3) mod 16  | 8      |
| X₄   | (5 × 8 + 3) mod 16  | 11     |
| X₅   | (5 × 11 + 3) mod 16 | 10     |

As you can see, you can't reasonably predict the next number in the sequence,
and this is sufficiently random enough for most purposes.

#### [A Ruby Implementation](#a-ruby-implementation)

This lightning talk was originally presented in Ruby, so here's a minimal LCG implementation:

{% highlight ruby %}
class LCG
  MODULUS    = 2**32
  MULTIPLIER = 1664525
  INCREMENT  = 1013904223

  def initialize(seed)
    @state = seed
  end

  def next_float
    @state = (@state * MULTIPLIER + INCREMENT) % MODULUS
    @state.to_f / MODULUS
  end
end

rng = LCG.new(42)
10.times { puts rng.next_float.round(4) }
# Same seed = same sequence, every time
{% endhighlight %}

#### [How to Choose Parameters](#how-to-choose-parameters)

The modulus is often a power of 2 for efficiency, and the multiplier and
increment are carefully chosen to ensure good statistical properties. The values
in this implementation are from [Numerical Recipes](http://numerical.recipes/),
a classic reference on algorithms.

The maximum period of an LCG (i.e. how long before the sequence repeats) is `m`.
**You only get the full period with the right combination of parameters.** Bad
parameters produce visibly non-random sequences with short cycles.

If a seed isn't supplied, a common approach is to derive one from the current
time. But two generators created at nearly the same time would get similar
seeds — so we hash the time first to ensure even small differences in input
produce completely different seeds.

---

### [A Word of Warning](#a-word-of-warning)

{% include callout.html
    content ="⚠️ LCG is a great educational example, but don't use it for production!"
    type="warning" %}

For the purposes of this post, LCG works well to demonstrate the fundamental
concepts of PRNGs and the deterministic nature of their output. It's not the
best choice for production use due to some statistical weaknesses:

- **Low bits have short periods:** if you're relying on lower-bit values, the least significant bits cycle much faster than the full sequence, leading to patterns and predictability.
- **Lattice structure:** if you plot consecutive LCG outputs as coordinates in higher dimensions, they fall on a small number of hyperplanes (Marsaglia's theorem[^1]). This means the numbers aren't as uniformly distributed as they should be, which can lead to biases in simulations.
- **Predictable:** given a few outputs, the parameters and next values can be recovered easily, making it unsuitable for cryptographic use.

Better PRNGs exist for production use, e.g. Mersenne Twister, xoshiro256**, and
PCG[^2] all address these issues.

{% include callout.html
    content ="The key thing to remember: same seed = same sequence."
    type="success" %}

---

## [Part 2: Randomized Testing with Seeded PRNGs](#part-2-randomized-testing-with-seeded-prngs)

### [The Case for Randomized Tests](#the-case-for-randomized-tests)

Traditional tests use hardcoded inputs. They only test what we thought to test.
Randomized tests generate inputs automatically, which means they can find edge
cases we didn't imagine.

If a random test fails, we need to be able to reproduce it. A test we can't
reproduce is worse than no test at all — it's a Heisenbug factory.

This is where the deterministic nature of PRNGs saves us. If we know the seed
that produced the failing run, we can replay the exact same sequence of "random"
data.

You might be thinking that this is fine and all, but random numbers won't help
you if your app works with strings, objects, etc. How do you generate random
strings? Random objects? Thankfully, there are plenty of libraries that do this
for you.

---

### [RSpec + FFaker: Practical Randomized Testing in Ruby](#rspec-and-ffaker)

Because this talk was originally in Ruby, here's a demonstration of how to set
up reproducible randomized tests using the RSpec testing framework and FFaker
library.

[FFaker](https://github.com/ffaker/ffaker) generates realistic fake data —
names, emails, addresses, phone numbers, etc. It has so much variety that you
will likely never spot a pattern, and it covers more edge cases than you could
come up with manually. Under the hood, it uses a PRNG to decide what to
generate. By default, each run gets a different seed, so the data changes every
time.

If we seed FFaker's PRNG with a known value, we get the same fake data in the
same order. RSpec already has a seed mechanism for randomizing test order, so
we just need to connect the two.

#### Wiring It Up

In `spec_helper.rb`, we tell FFaker to use RSpec's seed:

{% highlight ruby %}
RSpec.configure do |config|
  config.before(:all)  { FFaker::Random.seed = config.seed }
  config.before(:each) { FFaker::Random.reset! }

  config.order = :random
  Kernel.srand config.seed
end
{% endhighlight %}

`config.order = :random` tells RSpec to run tests in a random order (surfacing
order-dependent bugs). `Kernel.srand config.seed` seeds Ruby's built-in PRNG
with the same value. The `before` hooks ensure FFaker is in sync.

#### A Randomized Test

{% highlight ruby %}
describe 'Greeter' do
  it 'greets a person by name' do
    (1..5).each {
      Greeter.new.say_hi(FFaker::Name.unique.name)
    }
  end
end
{% endhighlight %}

Each run, FFaker generates different names. But given the same seed, it
generates the *same* different names.

#### Reproducing a Failure

When RSpec finishes, it prints the seed:

{% highlight bash %}
Randomized with seed 52157
{% endhighlight %}

To replay the exact same run — same test order, same generated data:

{% highlight bash %}
bundle exec rspec --seed 52157
{% endhighlight %}

This works even when reproducing failures from CI. Copy the seed from the
remote logs, run it locally, and you're debugging the exact same test run.

---

### [Catching Flaky Code](#catching-flaky-code)

Randomized testing is particularly good at catching code that only fails under
certain conditions. Consider this intentionally flaky calculator:

{% highlight ruby %}
class FlakyCalculator
  def maybe_add(a, b)
    luck = rand
    return a + b unless luck < 0.3
    "Oof! Better luck next time: #{luck}"
  end
end
{% endhighlight %}

With hardcoded test inputs, you'd need to run the test many times to hit the
30% failure case. With a seeded PRNG, once you find a seed that triggers it,
you can reproduce it reliably every time — and keep it as a regression test.

**It really is that simple.** You can have the best of both worlds: the
breadth of randomized testing and the reliability of deterministic tests.

---

### [Best Practices](#best-practices)

- **Always log the seed** so failures are reproducible. RSpec does this by default.
- **Keep randomized tests fast** — they should run on every CI build, not just nightly.
- **Complement, don't replace** deterministic tests. Use randomized tests to explore the input space, and hardcoded tests for known edge cases.
- **When a randomized test finds a bug**, add a deterministic regression test for that specific case. The randomized test found it; the deterministic test guards it.
- **Increase iterations periodically** — run 100x in a nightly build to cast a wider net.

{% include callout.html
    content ="Pseudo-random number generators are the engine behind randomized testing.
Understanding how they work and how to implement randomized tests will make your
testsuites do the work for you and improve overall test reliability."
    type="success" %}

---

{% include callout.html
    content ="Check out the companion repos: [my-pseudo-rand](https://github.com/tessapower/my-pseudo-rand) and [seeded_random_tests](https://github.com/tessapower/seeded_random_tests)"
    type="primary" %}

## References

[^1]: Marsaglia, G. (1968). "Random Numbers Fall Mainly in the Planes." *Proceedings of the National Academy of Sciences*.
[^2]: O'Neill, M. (2014). [PCG: A Family of Simple Fast Space-Efficient Statistically Good Algorithms for Random Number Generation](https://www.pcg-random.org/paper.html).
