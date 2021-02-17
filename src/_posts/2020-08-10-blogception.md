---
title: "Continuous Deployment for a Jekyll Static Site with GitHub and aws Amplify"
layout: post
tags: [blog, jekyll, github, aws, amplify]
---
## [A Static Site](#a-static-site)

When I was thinking about creating a website, I went looking for something that would keep things super simple, yet let me have full control over the design and functionality. A very smart person pointed me in the direction of Jekyll, which turned out to be perfect for someone who likes to dive into the code rather than fiddle with a GUI. The source code for my website would simply be stored in a repo on GitHub, not hiding behind an SP like Squarespace or Wix. Other nice details, like being able to write blog posts in Markdown, and that it's free, were also a deciding factor.

Keeping things "simple" meant that my workflow should look something like this:
<!--more-->

1. Make changes to source code locally.
2. Push changes to GitHub.

And that's it—super simple. It turns out there's a *little bit* more to it, but my main goal was to be able to deploy a website in two steps.

## [Step 1: Make changes locally](#step-1-make-changes-locally)

In reality, Step 1 looks more like:

1. Make changes locally:<br>
  a) Have an idea of something to write about.<br>
  b) Write a draft.<br>
  c) Rewrite the draft many, many times...<br>
  ![How I actually make changes to the website]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/writing-a-blogpost.gif)
  d) Create a bunch of GIFs and images.<br>
  e) Build Jekyll site to see how it looks.<br>
  f) Repeat steps **c)** through **e)** until satisfied.

You get the picture... Actually building the website locally to see how changes would look in the wild is pretty simple. Jekyll offers a few different commands (which I tend to forget so this serves as a reminder to my future self):

```bash
# Builds your site any time a source file changes and serves it locally
# The --open_url option opens the site's URL in the browser
jekyll serve --open_url

# An extra option I also like using is --future to show posts with future dates
jekyll serve --open_url --future

# Removes all generated files
jekyll clean

# Performs a one-off build—for when you need to generate the site for production
jekyll build
```

Running `jekyll serve` results in this:

![Checking changes in the wild]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/jekyll-serve.gif)

I only need to run this command once, and Jekyll will continue to serve any changes as I make them. That makes the hardest part of creating a Jekyll static site just thinking of new content.

## [Step 2: Push changes to GitHub *(...and automagically deploy a site)*](#step-2-push-changes-to-github-and-automagically-deploy-a-site)

I wanted to push changes to GitHub and not need to then worry about manually deploying the site. The perfect candidate for this job is [aws Amplify](https://aws.amazon.com/amplify/). One of Amplify's main selling points is using the Amplify console to host a static website with a Git-based workflow simply by connecting to my repo.

### What does aws Amplify do?

In a nutshell, Amplify works by watching one or multiple branches in my connected GitHub repo, and any time changes are pushed to that branch, it will build and deploy my Jekyll site based on my build settings.

![How Amplify Works]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/how-amplify-works.png)

Amplify has some pretty great features for someone looking to streamline their CD pipeline. There are quite a few, but my static site is simple so I mainly made use of the following:

- **Branch Auto-detection/-disconnection:** lets Amplify automatically connect to branches that match certain patterns in my repo, e.g. `feature/*` or `test/*`, and disconnects again when I delete them.
![Branch Auto-detection]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/branch-detection.jpg)

- **Domain Management:** lets me use my custom domain, and even create subdomains based on certain branch patterns. I use this to see how commits on my `feature/*` and `test/new-post` branches look in the wild before merging any changes to master. This is the one extra step I take so check that I didn't forget to push changes or miss anything in the final output.
![Domain Management]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/domain-mgmt.jpg)
This is well suited if you wanted to connect a dev/staging branch to a dev/staging environment, so that pushes to `staging/*` would trigger Amplify to build `https://staging.example.app`.

- **Access Control:** lets me slap a password on certain branches so I can work on new features without making them public. Trying to access `https://test.tessapower.co` will prompt you for credentials.
![Access Control]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/access-control.jpg)

### Setting up Continuous Deployment

The build settings are where I can run scripts that install dependencies, run tests, and build the Jekyll site for production. This is what my build settings currently look like:

```yaml
version: 0.1
frontend:
  phases:
    preBuild:
      commands:
        - gem install bundler
        - cd src
        - bundle install && bundle update
    build:
      commands:
        - JEKYLL_ENV=production bundle exec jekyll b
  artifacts:
    baseDirectory: src/_site
    files:
      - '**/*'
  cache:
    paths: []
```

When everything is connected up, I can see an overview of which branches are being built and their status:

![Branches in Amplify]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/branches-in-amplify.jpg)

## Deploying a Jekyll static site from the Command Line

The simplicity in this CD pipeline came about mostly from the groundwork of setting up the connection between GitHub and Amplify that suited my needs. The final result makes for a wonderfully succint workflow!

