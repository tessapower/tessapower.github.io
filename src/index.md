---
layout: default
title: Home 
---

## Hey, my name is Tessa.

<img alt="Me!" src="/assets/profile-photo.png" width="200" style="float:left;vertical-align:middle;margin:20px 10px"/> I'm a developer studying a BSc in Computer Science at Massey University. I'm looking for remote opportunities working in C++. We'll get along great if you like dogs and terrible puns! 

In a previous life, I worked at tech startups big and small, and studied Mechatronics at a German University.

You can find out more about me [here](/about/), check out things I've done [here](/projects/), and read about what I'm learning and working on [here](/blog/).

---

## Latest Post

{%- assign posts = paginator.posts | default: site.posts -%}
{% for post in posts limit:1 %}
  <article>
   {% include meta.html post=post preview=true %}
   {{ post.excerpt }}
   <div class="more"><a href="{{ post.url | relative_url }}">keep reading</a></div>
  </article>
{% endfor %}
