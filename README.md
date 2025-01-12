# `scrollomat`

### `Scrollomat` is a JS/TS library that allows you to write complex scrolling animations and effects straight into your HTML.

## General principles

The aim of `scrollomat` is to allow you to easily implement animations into your website which, instead of being 'animated'
in the traditional sense of occurring over time, vary only with scroll state. In other words, the library allows you to
define effects where the current frame is tied to how far you've scrolled on the page.

**`scrollomat` uses the 'vh' as its basic unit**: that is, 1/100th of the viewport height. The 'vh' acts as both a unit
of distance (how far down the page an element should be placed) as well as of time (how much scrolling needs to have 
taken place before a given effect kicks in). For example, in the language of `scrollomat`, the default website scrolling
behaviour can be described as "an animation of moving from 100vh to 0vh, over a duration of 100, starting at time 0":
when the page is at 0vh scroll, the element should be at 100vh offset, and by the time the page is at 100vh scrolled,
the element should be at 0vh offset (fully moved up the page).

The default effect in all cases is this: moving from 100vh to 0vh vertical offset. However, using the `!absolute`
directive, there's potential to do a lot more, and it's always possible to tie further effects such as opacity control
to the scroll state of the element, to make it fade in as it enters and fade out as it leaves.

## Usage

**Step 1.** Install `scrollomat`.

```
npm install scrollomat

yarn install scrollomat
```

**Step 2.** Set up your HTML container.

Ensure that your CSS is correctly configured too. The container IDs may be set to whatever you wish, but be sure to update
the CSS/JS in this example accordingly.

```html
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>My website</title>
        
        <style>
            #canvas {
                position: sticky;
                left: 0;
                top: 0;
                z-index: 1;
                text-align: center;
                width: 100vw;
                overflow-x: clip;
                pointer-events: none;
            }
        </style>
    </head>
    <body>
        <div id='scroll-watcher'></div>
        <div id='canvas'>
            <!-- Content goes here -->
        </div>
        
        <script src='./script.js'></script>
    </body>
</html>
```

**Step 3.** Initialise `scrollomat` in your source code.

```typescript
// script.ts

import Scrollomat from 'scrollomat';

const canvas = document.getElementById('canvas')!;
const scrollWatcher = document.getElementById('scroll-watcher')!;

const scroller = new Scrollomat(canvas);
scroller.mountToWatcher(scrollWatcher);
```

**Step 4.** You're ready to go! Now, you can begin to define your scroll animations inside `#canvas`.

This is done by **specifying the `scroll-data` attribute on each top-level child of `#canvas`**. The full explanation of
the syntax of `scroll-data` is explained in the following section, but find a few examples below:

```html
<div id='canvas'>
    <!--  Normal scrolling. Behaves like an ordinary HTML element.  -->
    <div id='first-elem' scroll-data='enter 0; leave 100;'></div>

    <!--  Scrolls at half speed.  -->
    <div scroll-data='enter 0; leave 200;'></div>

    <!--  Scrolls at half speed, and enters after one full page-length of scrolling (i.e., after #first-elem has left)  -->
    <div scroll-data='enter 100; leave 300;'></div>

    <!--  As above, but defined relatively  -->
    <div scroll-data='enter with-exit first-elem; duration 200;'></div>

    <!--  As above, but fades quickly upon entering, and fades quickly out while leaving  -->
    <div scroll-data='enter with-exit first-elem; duration 200; opacity-easing 0 1 0 1 1 0 1 0;'></div>

    <!--  
        This is a more complex instruction.
        Broken down directive-by-directive:
            - Enters !absolute mode (see next section)
            - Enters 200vh after #first-elem scrolls out of view
            - Lasts 200vh after that (i.e., half of normal scrolling speed)
            - Is fixed at `left: 30vw`
            - Transitions between `top: 40vh` to `top: 20vh` over on-screen visibility period
            - Gradually fades in then back out
    -->
    <div scroll-data='!absolute; enter after-exit first-elem 200; duration 200; x 30; y 40 20; opacity-easing 0.3 0 0.3 1 0.7 0 0.7 1;'></div>
</div>
```

## The `scroll-data` API

The following options are available to use within `scroll-data`. In general, they can be arranged in any order, though
note that `!absolute` _must_ be first if present, and `leave` will necessarily take precedence over `duration` if both 
are present (though there is no legitimate usage in which this would be the case).