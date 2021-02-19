---
title: "A fast, modern Static Site—authored in Markdown, deployed to AWS"
layout: post
tags: [blog, jekyll, github, aws, amplify, serverless, cloudfront, markdown]
---
In this post, I'm going to talk about how I set up and deployed a static site that's fast, modern, serverless, and written in Markdown to AWS. And it cost me **$0.00**.

### [The Goal](#the-goal)

I wanted to create a website to write about things I'm working on and learning. I only had a few requirements:
<!--more-->

- fast;
- inexpensive;
- minimal setup;
- low maintenance;
- lets me write posts in Markdown;

Why not Squarespace, Wix, or Wordpress? ~$15/month for a simple static site and WYSIWYG text editors with 1000 buttons—*no, thanks*.

---
### [Jekyll—the static site](#jekyll-the-static-site)

I chose to use *[Jekyll](https://jekyllrb.com/)*—an open-source, blog-aware static site generator. Compared to other options, Jekyll ticked a lot of the boxes:

- Setup is super quick;
- Only needs to be built once, so it's fast;
- No moving parts that can break or require maintenance;
- Write content in Markdown, which makes things readable in plain text on GitHub;

After set up, it was extremely simple to add content and build the site locally:

![Building the site locally]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/jekyll-serve.gif)

Run `bundle exec jekyll serve` once and Jekyll will continue to serve any changes as I make them—making the hardest part thinking of new content.

Here are a few useful commands (this also serves as a reminder to my future self):

```bash
# Builds your site any time a source file changes and serves it locally
# The --open_url option opens the site's URL in the browser
bundle exec jekyll serve --open_url

# Lets you view posts in the _drafts folder as if they were published
bundle exec jekyll serve --drafts

# Lets you view posts that have future dates as if they were already published
bundle exec jekyll serve --future

# Removes all generated files
bundle exec jekyll clean

# Performs a one-off build—for when you need to generate the site for production
bundle exec jekyll build
```

---

### [Deploying to AWS with Amplify Console](#deplying-to-aws-with-amplify-console)

To build, host, and deploy my static site, I use the [AWS Amplify Console](https://aws.amazon.com/amplify/hosting/). In a nutshell, Amplify Console provides fully managed hosting for static sites and web apps.

By connecting Amplify Console to a GitHub repo, I can continuously deploy my static site simply by git pushing commits to connected branches. Amplify Console will build the site or app based on the build settings (including running any pre- or post-build commands and tests), and deploy it to Amazon's CDN.

Amplify Console offers some pretty useful features:

- **Branch Auto-detection/-disconnection:** lets Amplify automatically connect to branches that match certain patterns, e.g. `feature/*` or `release*`, and automatically disconnects when branches are deleted.
- **Domain Management:** connect branches to domains or subdomains, e.g. commits to `dev/*` trigger a build and deploy changes to `https://dev.example.app`. You also get a free HTTPS certificate so your site is secure.
- **Access Control:** add a password to certain sub-domains to work on new features or content without making it public.
- **Previews:** see a preview of how your site looks on different devices before merging to the production branch.

There are a bunch more features which I haven't mentioned—these are just the ones I found useful.

When everything is set up, you can see an overview of which branches will be built, any previous builds, and their statuses:

![Branches in Amplify]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/branches-in-amplify.jpg)

---
#### [Behind Amplify Console](#behind-amplify-console)

Amplify Console leverages **S3** and **Cloudfront** to build, deploy, and serve static sites and SPAs. According to their website, Cloudfront has *"225+ Points of Presence (215+ Edge locations and 12 regional mid-tier caches) in 89 cities across 46 countries."*, which means it really is as close as possible to the requesting client, and has excellent availability (99.99%). Combined with S3, which has [11 9's of durability](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DataDurability.html), it's a pretty solidly supported and well distributed static site.

![Amazon Cloudfront Edge Locations]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/cloudfront-cdn.png)

### [My setup](#my-setup)

For my site, Amplify Console automatically detects branches that match `feature/*` or `test/*` to build and deploy to the subdomains `https://feature.tessapower/co` and `https://test.tessapower.co`.

![Branch Auto-detection]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/branch-detection.jpg)

![Domain Management]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/domain-mgmt.jpg)

Previews let me see how my site looks on different devices after building it—I use this as a final checkpoint because merging to `master`.

![Previews]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/preview-checks.gif)

I use Access Control to prompt anyone who tries to access `https://test.tessapower.co` for credentials, so it's a safe place for me to test changes in the wild.

![Access Control]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/access-control.jpg)

---
### [My workflow](my-workflow)

Not only is this approach modern and extremely fast, it has made my workflow pretty lean. I can create a new post and deploy my website with just one line of code! Here's what it looks like (@500x speed):

![End to End Continuous Deployment]({{ site.baseurl }}/assets/posts/2020-08-10-blogception/end-to-end.gif)

---
### [The Stats](#the-stats)

| **Availability**                      | Four 9's        |
| **Time to set up**                    | 0.5 hours       |
| **Average Latency (worldwide)**       | ~15ms           |
| **Amount of gross PHP or JavaScript** | 0 lines         |
| **Total cost**                        | $0.00           |
| **My face**                           | (ﾉ◕ヮ◕)ﾉ*:・ﾟ✧ |

{% include callout.html
    content="*I already have my custom domain and DNS set up with Route53—this extra setup comes within Amazon's Free Tier."
    type="default" %}