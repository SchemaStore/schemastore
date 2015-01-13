(function (global) {
    "use strict";

    if (!global.React)
        return;

    global.ReactSpecification = function () {

        return {
            /**
             * The render() method is required.
             * @returns {ReactElement}
             */
            render: function () { },

            /**
             * Invoked once before the component is mounted. The return value will be used as the initial value of 'this.state'.
             * @returns {object}
             */
            getInitialState: function () { },

            /**
             * Invoked once and cached when the class is created. Values in the mapping will be set on 'this.props' if that prop is not specified by the parent component.
             * @returns {object}
             */
            getDefaultProps: function () { },

            /**
             * The 'propTypes' object allows you to validate props being passed to your components.
             * @returns {object}
             */
            propTypes: function () { },

            /**
             * The 'mixins' array allows you to use mixins to share behavior among multiple components. 
             * @returns {array}
             */
            mixins: function () { },

            /**
             * The statics object allows you to define static methods that can be called on the component class.
             * @returns {object}
             */
            statics: function () { },

            /// <field name="displayName" type="String">The 'displayName' string is used in debugging messages. JSX sets this value automatically.</field>
            displayName: "",

            /**
             * Invoked once, both on the client and server, immediately before the initial rendering occurs. If you call 'setState' within this method, 'render()' will see the updated state and will be executed only once despite the state change.
             * @returns {function}
             */
            componentWillMount: function () { },

            /**
             * Invoked once, only on the client, immediately after the initial rendering occurs. At this point in the lifecycle, the component has a DOM representation which you can access via 'this.getDOMNode()'.
             * @returns {function}
             */
            componentDidMount: function () { },

            /**
             * Invoked when a component is receiving new props. This method is not called for the initial render.
             * @param {object} nextProps
             * @returns {function}
             */
            componentWillReceiveProps: function () { },

            /**
             * Invoked before rendering when new props or state are being received. This method is not called for the initial render or when 'forceUpdate' is used.
             * @param {object} nextProps
             * @param {object} nextState
             * @returns {Boolean}
             */
            shouldComponentUpdate: function () { },

            /**
             * Invoked immediately before rendering when new props or state are being received. This method is not called for the initial render.
             * @param {object} nextProps
             * @param {object} nextState
             * @returns {function}
             */
            componentWillUpdate: function () { },

            /**
             * Invoked immediately after updating occurs. This method is not called for the initial render.
             * @param {object} nextProps
             * @param {object} nextState
             * @returns {function}
             */
            componentDidUpdate: function () { },

            /**
             * Invoked immediately before a component is unmounted from the DOM.
             * @returns {function}
             */
            componentWillUnmount: function () { },
        }
    };

    intellisense.annotate(React, {
        /**
         * Create a component given a specification. A component implements a 'render' method which returns one single child.
         * @param {ReactSpecification} specification
         */
        createClass: function () { },

        /**
         * Create and return a new ReactElement of the given type.
         * @param {string/ReactCompenent} type  - The type argument can be either an html tag name string (eg. 'div', 'span', etc), or a ReactComponent class that was created with React.createClass.
         * @param {object} [props]
         * @param {children...} [children...]
         * @returns {ReactElement}
         */
        createElement: function () { },

        /**
         * Render a ReactElement into the DOM in the supplied container and return a reference to the component.
         * @param {ReactElement} ReactElement - The ReactElement to render into the DOMElement.
         * @param {HTMLElement} DOMElement - The DOM element to render the ReactElement into.
         * @param {function} [callback] - If the optional callback is provided, it will be executed after the component is rendered or updated.
         * @returns {ReactSpecification}
         */
        render: function () { },

        /**
         * Remove a mounted React component from the DOM and clean up its event handlers and state. If no component was mounted in the container, calling this function does nothing.
         * @param {HTMLElement} container
         * @returns {Boolean} Returns true if a component was unmounted and false if there was no component to unmount.
         */
        unmountComponentAtNode: function () { },

        /**
         * Render a ReactElement to its initial HTML. This should only be used on the server. React will return an HTML string. You can use this method to generate HTML on the server and send the markup down on the initial request for faster page loads and to allow search engines to crawl your pages for SEO purposes.
         * @param {ReactElement} element
         * @returns {string}
         */
        renderToString: function () { },

        /**
         * Similar to renderToString, except this doesn't create extra DOM attributes such as data-react-id, that React uses internally. This is useful if you want to use React as a simple static page generator, as stripping away the extra attributes can save lots of bytes.
         * @param {ReactElement} element
         * @returns {string}
         */
        renderToStaticMarkup: function () { },

        /**
         * Configure React's event system to handle touch events on mobile devices.
         * @param {Boolean} shouldUseTouch
         * @returns {void}
         */
        initializeTouchEvents: function () { },

        /**
         * Checks if the specified element is valid.
         * @param {ReactElement} element
         * @returns {Boolean}
         */
        isValidElement: function () { },

        /// <field name="version" type="String">The current version of React.</field>
        version: "",

        /**
         * Checks if the specified element is valid.
         * @param {object} object
         * @param {function} callback
         * @returns {ReactComponent}
         */
        withContext: function () { },
    });

    global.Error = function (message) {
        intellisense.logMessage(message);
    };

    var hidden = ["ReactSpecification"];
    var reactDeprecated = ["renderComponent", "renderComponentToString", "renderComponentToStaticMarkup", "isValidClass", "isValidComponent"];
    var propTypesDeprecated = ["renderable", "component"];

    intellisense.addEventListener('statementcompletion', function (event) {

        if (event.targetName === "React") {
            event.items = event.items.filter(function (item) {
                return reactDeprecated.indexOf(item.name) === -1
            });
        }

        if (event.targetName === "PropTypes") {
            event.items = event.items.filter(function (item) {
                return propTypesDeprecated.indexOf(item.name) === -1
            });
        }

        event.items = event.items.filter(function (item) {
            return hidden.indexOf(item.name) === -1
        });
    });

})(this);