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

 - `enter` - sets the entry time
 - `leave` - sets the exit time
 - `duration` - sets the duration (i.e., sets `leave` to `enter` + `duration`)
 - `ease` - takes four numbers, `x1 y1 x2 y2`. These define a cubic bezier for the motion of the element over the page.
 - `opacity-easing` - takes eight numbers, `x1 y1 x2 y2 x3 y3 x4 y4`. The first four define an easing curve for the object to fade in over its lifespan, the second for for it to fade out. Alternatively, provide only `x1 y1 x2 y2`, which will then represent the entire easing curve.

For `enter` and `leave`, instead of specifying a number (to specify a global scroll `vh` at which point the element should enter/leave by), you can also use the following:

 - `after-entry {id} {amount}` - shorthand for whatever the entry time of the element with id `{id}` is, plus `{amount}` (which can also be negative)
 - `after-exit {id} {amount}` - shorthand for whatever the leave time of the element with id `{id}` is, plus `{amount}` (which can also be negative)
 - `with-entry {id}` - shorthand for `after-entry {id} 0`
 - `with-exit {id}` - shorthand for `after-exit {id} 0`

For _all_ properties, including `enter` and `leave`, you can also use `like {id}`, which copies the value of said property in `{id}`. For instance, `<div id="second-elem" scroll-data="duration like first-elem">` will set the duration of `second-elem` to the same as that of `first-elem`.

### `!absolute` mode

Beginning your `scroll-data` entry with `!absolute` will enter a special mode for overriding the default behaviour 
(i.e., scrolling from bottom to top), whereby you can use the two additional directives, `x` and `y`. Possible values for these are:

 - `like {id}`, cloning the `x`/`y` value of element `id`
 - A single number, to represent a fixed position of the element on the screen (in `vh`/`vw`)
 - A list of numbers, to move between over the course of the element's lifetime. For instance, if four values are specified and `duration 200` is set, then the element will take `50vh` of scrolling to animate between them.
 - A list of numbers and an easing function to use when transitioning between them, in the format `{value-1} {value-2} {...} {value-n} | x1 y1 x2 y2 |`. Similar to above, but allows you to specify a custom easing function.
 - Fully manual control, specifying positions, easing functions, _and_ setting custom/varied durations for each stage (as opposed to assigning each position/transition equal time). The format for this is repeated sequences of:

```
[time]: [start-pos]? - [end-pos] | [x1] [y1] [x2] [y2] |
```

 - `time` represents the time the movement should finish by. **Note that this is relative** to the lifetime of the event, so `0` here is whatever `enter` is for the element.
   - This can be a number or the format `+{number}`, which autofills with the previous value plus an amount.
 - `start-pos` and `end-pos` may be numeric values or `like` clauses (but this will only work if the referenced element has a corresponding `x`/`y` which is a _single-number_ value)
   - `start-pos` may be omitted, in which case it will autofill to the `end-pos` of the previous spec
 - The easing function is defined as with `ease` above.