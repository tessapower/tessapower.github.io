---
title: "Automating C++ unit tests with GitHub Actions, MSBuild, and VS Test Platform"
layout: post
tags: [c++, github-actions, vs]
---

In a [previous post]({% post_url 2020-06-02-unit-testing-cpp-terminal-app-native-visual-studio %}), I created unit tests for a console app using Visual Studio's Native C++ Framework and Test Platform. The process of running the tests with `VSTest.console.exe` in Terminal was rather tedious, so I decided to automate the process using GitHub Actions.

<img alt="GitHub Actions in Action" src="{{ site.baseurl }}\assets\posts\2020-06-20-github-actions\action-in-action.gif">

<!--more-->

## Table of Contents

- [Table of Contents](#table-of-contents)
- [GitHub Actions](#github-actions)
  - [Why GitHub Actions?](#why-github-actions)
- [Setting up a new workflow](#setting-up-a-new-workflow)
- [What to Automate](#what-to-automate)
- [Configuring the Workflow](#configuring-the-workflow)
  - [Step 1: Check out the Code](#step-1-check-out-the-code)
  - [Step 2: Build the Project](#step-2-build-the-project)
  - [Step 3: Run the Tests](#step-3-run-the-tests)
- [Putting the Workflow to Work](#putting-the-workflow-to-work)
  - [What's Next?](#whats-next)
  - [Stuff that Didn't Go to Plan](#stuff-that-didnt-go-to-plan)
    - [Job scope](#job-scope)
    - [Environment variables syntax](#environment-variables-syntax)

---

## [GitHub Actions](#github-actions)

[GitHub Actions](https://help.github.com/en/actions/getting-started-with-github-actions/about-github-actions) are essentially scripts that help to automate workflows directly in your GitHub repos. The Actions run on remote servers (called _runners_) and can be used to build, test, integrate and deploy projects. There is even a marketplace, where you can find ready-to-use Actions for common workflows.

### Why GitHub Actions?

Not only do I love of all things GitHub, Actions genuinely sounded perfect for automating C++ unit tests. I wanted to learn about Actions not just to automate unit tests, but also to prevent me from introducing bugs. If any of the tests don't pass, then my Action will fail and I'll be notified. This will come in handy when I have many more tests, and don't run them all while coding.

When you're working in a team, Actions is great to combine with the [Branch Protection Rules](https://help.github.com/en/github/administering-a-repository/defining-the-mergeability-of-pull-requests) feature, which I'll talk about in another blog post. Basically, an Action can act as a check. Merging PRs to protected branches is disabled unless the check is successful. And, if that wasn't good enough, it's totally free!

---

## [Setting up a new workflow](#setting-up-a-new-workflow)

Setting up a workflow in my repo was super simple—here's how I did it:

1. Navigate to the repo where the workflow will run.
2. Click the `Actions` tab.
    <img alt="The Actions Tab" src="{{ site.baseurl }}\assets\posts\2020-06-20-github-actions\ttt-repo.jpg">
3. Click `New Workflow`.
    <img alt="New Workflow" src="{{ site.baseurl }}\assets\posts\2020-06-20-github-actions\new-workflow.jpg">

That's it, like I said—super simple! Alternatively, you can create a workflows folder in the root of your repo under `.github/workflows` and add a new `.YAML` or `.YML` file—this is where you configure your workflow.

---

## [What to Automate](#what-to-automate)

Before configuring my workflow, I needed to figure out what it should actually do. The easiest way I found was to treat it like setting up a new machine. That meant my workflow needed to:

1. Check out the code—the runner doesn't automatically do this.
2. Build the project—to generate the unit tests `.dll` file.
3. Run the tests—if any of the tests fail, the action will fail.

{% include important.html
content="I found out later that this high-level description needed to be fleshed out a lot, which I describe in more detail below." %}

## [Configuring the Workflow](#configuring-the-workflow)

My workflow, creatively named `Build and Test`, needs to build and test my Visual Studio console app, and will run on pushes to or pull requests for the branches `master`, `test/*`, `feature/*`, or `bugfix/*`.

### Step 1: Check out the Code

This step is pretty easy—use GitHub's own [Checkout Action](https://github.com/marketplace/actions/checkout).

```yml
# Step 1: Check out the code
- name: Checkout code
  uses: actions/checkout
```

### Step 2: Build the Project

To build my project, I used [MSBuild](https://en.wikipedia.org/wiki/MSBuild), which is Microsoft's Build Engine. The great thing about MSBuild is it lets you build native C++ Visual Studio projects without VS needing to be installed. I quickly figured out that this step should actually be TWO steps.

First, locate `msbuild.exe` on the runner and add it to PATH. For this, I used Microsoft's [Setup MSBuild.exe](https://github.com/marketplace/actions/setup-msbuild-exe) Action:

```yml
# Step 2.1: locate msbuild.exe and add to PATH
- name: Add MSBuild to PATH
  uses: microsoft/setup-msbuild
```

Second, run MSBuild in the shell and build the project:

```yml
# Step 2.2: run MSBuild
- name: Run MSBuild
  run: msbuild.exe .\path\to\project
```

### Step 3: Run the Tests

I found Visual Studio on the [list of software installed on runners](https://help.github.com/en/actions/reference/software-installed-on-github-hosted-runners), which meant that I could use the VS Test Console tool to run unit tests like I normally would locally. After many (many) tests, I realised that this step also needed to be two steps.

First, locate `vstest.console.exe` on the runner and add it to PATH. For this, I adapted the [Setup VSTest.console.exe](https://github.com/marketplace/actions/setup-vstest-console-exe) Action from GitHub user [darenm](https://github.com/darenm). The Action is intended for a UWP app, so some of the steps aren't necessary for a console app.

```yml
# Step 3.1: locate vstest.console.exe and add to PATH
- name: Setup VSTest path
  uses: darenm/Setup-VSTest@v1
```

Second, run VSTest in the shell to run the tests:

```yml
# Step 3.2: run VSTest
- name: Run VSTest
  run: vstest.console.exe /Platform:x64 .\path\to\dll
```

Put everything together, and this is what `Build and Test` looks like:

```yml
# This workflow sets up and runs MSBuild and VSTest
# to build and test a Visual Studio solution.

name: Build and Test

on: [push, pull_request]
  branches:
    - master
    - test/*
    - feature/*
    - bugfix/*

jobs:
  run-msbuild-vstest:
  runs-on: windows-latest
  name: Run MSBuild and VSTest

  steps:
    - name: Checkout code
      uses: actions/checkout@v2.1.0
      id: checkout_code

    - name: Setup MSBuild and add to PATH
      uses: microsoft/setup-msbuild@v1.0.0
      id: setup_msbuild

    - name: Run MSBuild
      id: run_msbuild
      working-directory: ${{ github.workspace }}
      run: msbuild .\TheGame.sln

    - name: Setup VSTest and add to PATH
      uses: darenm/Setup-VSTest@v1
      id: setup_vstest

    - name: Run VSTest
      id: run_vstest
      working-directory: ${{ github.workspace }}\x64\Debug\
      run: vstest.console.exe /Platform:x64 .\UnitTests.dll
```

---

## [Putting the Workflow to Work](#putting-the-workflow-to-work)

After a bunch of testing, reading logs, and fine-tuning, it's working! It was super useful to watch the build logs once the workflow triggered. You can find them under the `Actions` tab. Just click on any of the events that triggered your workflow to see more information. Here you will also find tests results, artifacts, and statuses for each step.

<img alt="GitHub Actions Build Logs" src="{{ site.baseurl }}\assets\posts\2020-06-20-github-actions\actions-build-log.gif">

Now that my workflow is working, any pushes to remote branches will trigger the tests to run. And just for fun, I added a status badge for `master` to the repo's README:

![Build and Test](https://github.com/tessapower/tictactoe/workflows/Build%20and%20Test/badge.svg?branch=master)

---

### [What's Next?](#whats-next)

Starting with something small was the perfect test, and helped me see that GitHub Actions can help me automate in many other areas. The next thing I'm going to do is create an action to Lint check all `.cpp` files!

---

{% include callout.html
    content="Take a look at [the workflow](https://github.com/tessapower/tictactoe/blob/master/.github/workflows/build.yml) on Github"
    type="primary" %}

---

### [Stuff that Didn't Go to Plan](#stuff-that-didnt-go-to-plan)

I made a fair few mistakes and did a lot of rewrites to get to the above configuration! Because GitHub Actions is still quite new, the documentation is a WIP. Changes have not been updated everywhere, so sometimes there was conflicting information. With a bit of trial and error, and after reading through the workflow build logs, I got things back on track.

#### Job scope

The first thing that tripped me up was _job scope_ (like _block scope_). Initially, I had multiple jobs—one job to set up MSBuild and VSTest, and one job to run them. This caused an error, so I rummaged around in the build logs to figure out what was going on.

The issue was that the second job didn't have access to the changes made in the first job. After finishing the first job (setting up MSBuild and VSTest) the runner reset _everything_. No data, outputs, or the state of the runner persists after a job finishes, even within the same workflow.

If you need anything for another job, use global variables (called _environment variables_). To solve this for my workflow though, I put all the steps to setup and run MSBuild and VSTest into one job.

#### Environment variables syntax

For commands that require a relative path, you need to specify the working directory. For my workflow, this was the root folder of the repo and generated build folder, as MSBuild and VSTest need the relative paths to the `.sln` and `.dll` files respectively.

GitHub's documentation on Actions is extensive, but not exhaustive, and I found conflicting information where changes haven't been updated. This was the error that prompted me to dig around the docs some more:

<img alt="GITHUB_WORKSPACE Error" src="{{ site.baseurl }}\assets\posts\2020-06-20-github-actions\gh-workspace-error.jpg">

The issue was that GitHub's [list of default environment variables](https://help.github.com/en/actions/configuring-and-managing-workflows/using-environment-variables#default-environment-variables) states `GITHUB_WORKSPACE` is the GitHub workspace directory path. After digging around, I found out it should be `github.workspace`.

This fix was pretty easy—just update the environment variable for the working directory:

```yml
- name: ...
  # working-directory: {% raw %}${{ GITHUB_WORKSPACE }}{% endraw %}
  working-directory: {% raw %}${{ github.workspace }}{% endraw %}
  run: ...
```
