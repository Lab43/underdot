# Underdot

Underdot is a static site generator written in node.js that I built primarily to make marketing sites. The static site generators I had tried at the time were geared towards blogs, with a strong separation between template/layout code and content. That makes a lot of sense if your website has tons of pages that should all pretty much look the same. But when you're building a small site with many unique pages, each with different designs, that model breaks down. I wanted a system that I could throw a bunch of templates, assets, and content at and have it use some simple inheritance logic and a robust plugin system to spit out my site with minimal need for scaffolding or configuration.

#### Sites built with Underdot include:

* [eusonic](https://www.eusonic.com)
* [Di Costanzo](https://www.mdcwines.com)
* [Kinsman Eades](https://www.kinsmaneades.com)
* [Impensata](https://impensata.com)
* [Abreu](https://abreuvineyards.com)
* [Almacerro](https://almacerro.com) 


## Setting it up

[underdot-boilerplate](https://github.com/Lab43/underdot-boilerplate) is a starter site you can use to get up to speed quickly and see how Underdot works.

At a minimum you need to install Underdot and a template engine. Currently the only available template engine is [EJS](https://ejs.co). Run `npm install underdot underdot-ejs`. Now we need a node.js file to run Underdot.

`index.js` 


```
const Underdot = require('underdot');
const ejs = require('underdot-ejs');

const underdot = new Underdot({
  plugins: [
    ejs(), // you need at least one template engine for Underdot to work
  ]
});

underdot.build();
```

Put all your content and templates in a folder called `source` then run `node index.js` to build your site. 


## Configuration

Here are the options that can be passed to Underdot (`new Underdot(options)`).

| Option      | Description                                                      |
| ----------- | ---------------------------------------------------------------- |
| source      | String: The name of the source directory. Defaults to source.    |
| destination | String: The name of the output directory. Defaults to build.     |
| plugins     | Array: Underdot plugins to use, in order.                        |
| globals     | Object: Global variables passed to all pages and templates.      |
| concurrency | Integer: How many files to process concurrently. Defaults to 10. |


## Template inheritance

The key concept in Underdot (and where it gets its name from) is it's template inheritance logic. The default template is `_.ejs` (or whatever file extension matches the templating language you're using). There *must* be an `_.ejs` file at the top level of the source directory, which all pages will eventually be rendered through.

Template files must start with an underscore. Each page you create can specify what template to use in YAML front matter (more on this latter). If no template is specified Underdot will look for an `_.ejs` template. First it will look in the same directory as that page then it will look in the parent directory, and so on, until it gets to `source/_.ejs`. The templates themselves can also specify parent templates in YAML front matter, or will also get passed to the next closest `_.ejs` file.

Here's an example file structure
```
source/
  _.ejs
  _fancy.ejs
  index.ejs
  a-very-fancy-page.ejs
  about/
    team.ejs
    _.ejs
```

Let's say that the pages `index.ejs` and `team.ejs` don't specify what template they want to use. `index.js` will use the root `_.ejs` file. `team.ejs` will use `about/_.ejs` which will then use the root `_.ejs` template.

Let's say that `a-very-fancy-page.ejs` has YAML front matter that specifies the `_fancy.ejs` template. It will use that template, which will then use the root `_.ejs` template.


## YAML front matter and variables

You can use [YAML front matter](https://jekyllrb.com/docs/front-matter/) to specify a template or to pass variables to the template engine.

`source/a-very-fancy-page.ejs`
```
---
title: A Very Fancy Page
template: fancy
---

<h1><%= title %></h1>
<p>Isn't it lovely?</p>
```

Templates also get passed a `content` variable that contains the content of the page being rendered. Here's an example of the root `_.ejs` template:

`_.ejs`

```
<!doctype html>
<html>

<head>
  <title><%= title %></title>
</head>

<body>
  <header>The site header</header>
  <article>
    <%- content %>
  </article>
  <footer>The site footer</footer>
</body>

</html>
```


## Other files

Files in the `source` directory with other file extensions, such as images, will get copied to the output directory when the site is compiled *unless* they start with an underscore, in which case they will be skipped. Skipped files are still passed to plugins, which could result in them being modified and output.



## Plugins

Underdot has a flexible plugin system. A basic plugin looks like this:

```
module.exports = (options) => (plugin) => {
  // do stuff with the plugin methods
}
```

The `options` are whatever is passed into the plugin when it's used in an Underdot site. `plugin` contains several methods to interact with Underdot and the files its processing.


### `plugin.registerTemplateHelper(name, callback)`

Create a function that will be made available in pages and templates. For example:

`underdot-capitalize.js`

```
module.exports = (options) => (plugin) => {

  plugin.registerTemplateHelper('capitalize', (text) => {
    return text.toUpperCase();
  });

}
```

Used in a page:

`team.ejs`

```
<div class='team'>
  <% team.forEach((member) => { %>
    <h2><%= capitalize(member.name) %></h2>
    <p><%= member.role %></p>
  <% }); %>
</div>
```


### `plugin.registerFileHandler(rule, callback)`

Register a file handler which will be passed all files that match the rule. Rule matching is handled by [minimatch](https://github.com/isaacs/minimatch). The second argument is a function that will get passed an object with the path to the file and the file contents (`{path, file}`). This function can return an object with the same structure, or a promise that resolves with that object.

`underdot-minify.js`

```
const minify = require('./utils/minify');

module.export = (options) => (plugin) => {

  plugin.registerFileHandler(options.rule || '**/*.js', ({path, file}) => {
    return {
      path: path.replace('.js', '-min.js'),
      file: minify(file);
    }
  });

}
```


### `plugin.enqueueFile(path, callback)`

Add a file to the output. The first argument is the path of that file and the second is a function which returns the contents of that file, or a promise that resolves with the contents. That file will also get passed to the file handlers of subsequent plugins.


### `plugin.registerRenderer(extension, callback)`

Register a template engine. The first argument is the file extension for this renderer to handle (such as `.ejs`) and the second argument is a function that gets called when a page or template is being rendered, which is passed 3 arguments: the contents of the file, the metadata (YAML front matter and globals), and an object with template helper functions that have been registered by other plugins.


## Available plugins

* [underdot-ejs](https://github.com/Lab43/underdot-ejs): Render ejs templates
* [underdot-sass](https://github.com/Lab43/underdot-sass): Compile sass files
* [underdot-postcss](https://github.com/Lab43/underdot-postcss): Use postcss to transform your css, for example adding vendor prefixes
* [underdot-srcset](https://github.com/Lab43/underdot-srcset): Responsive images
* [underdot-svgo](https://github.com/Lab43/underdot-svgo): Use [SVGO](https://github.com/svg/svgo) to optimize SVGs
* [underdot-bust](https://github.com/Lab43/underdot-bust): Bust browser caches when assets change by appending a hash to the file name
* [underdot-cname](https://github.com/Lab43/underdot-cname): Add a cname file for GitHub Pages
* [underdot-template-helpers](https://github.com/Lab43/underdot-template-helpers): Commonly used template helpers
* [underdot-collection](https://github.com/Lab43/underdot-collection): WORK IN PROGRESS. Turn a folder of pages into a collection that can be used in templates
