define([
    "dojo/_base/declare",
    "dojo/aspect",

    "epi/_Module",
    "epi/routes",
    "epi/dependency",
], function (
    declare,
    aspect,

    _Module,
    routes,
    dependency
) {
        return declare([_Module], {
            initialize: function () {
                this.inherited(arguments);

                this._replaceCreateCommand();
            },

            _replaceCreateCommand: function () {
                var widgetFactory = dependency.resolve("epi.shell.widget.WidgetFactory");
                aspect.after(widgetFactory, "onWidgetCreated", function (widget, componentDefinition) {
                    if (componentDefinition.widgetType === "epi/shell/widget/WidgetSwitcher") {
                        aspect.around(widget, "viewComponentChangeRequested", function (originalMethod) {
                            return function () {
                                if (arguments[0] === "epi-cms/ContentEditing/CreateContent") {
                                    arguments[0] = "foundation/ContentEditing/CreateContent";
                                }
                                originalMethod.apply(this, arguments);
                            };
                        });
                    }
                }, true);
            }
        });
});

//define([// Dojo
//    "dojo",
//    "dojo/_base/declare",
//    "dojo/on",
//    "dijit/registry",
//    //CMS
//    "epi/_Module",

//    "epi/dependency",
//    "epi/routes",
//    "epi/shell/store/JsonRest",

//    "epi/shell/widget/dialog/Dialog",
//    "epi-cms/widget/ContentReferences",
//    "epi-cms/widget/ContentSelector",

//    "epi/i18n!epi/cms/nls/episerver.shared.action"
//],
//    function (
//        // Dojo
//        dojo,
//        declare,
//        on,
//        dijitRegistry,
//        //CMS
//        _Module,

//        dependency,
//        routes,
//        JsonRest,

//        Dialog,
//        ContentReferences,
//        ContentSelector,

//        resources
//    ) {

//        // last selected link cleared when opening references dialog
//        var lastSelectedLink = null;

//        // create dialog that allows to replace links
//        function createDialog(container) {
//            var contentSelector = new ContentSelector({
//                roots: [1]
//            });


//            var dialog = new Dialog({
//                dialogClass: "epi-dialog--wide",
//                defaultActionsVisible: true,
//                confirmActionText: "Change",
//                content: contentSelector,
//                title: "Replace content with another content",
//                focusActionsOnLoad: true
//            });

//            container.own(dialog);
//            dialog.own(contentSelector);

//            on.once(dialog, "show", function (value) {
//                // set epiStringList class to have width 100% for property
//                contentSelector.displayNode.classList.add("epiStringList");

//                if (lastSelectedLink) {
//                    contentSelector.set("value", lastSelectedLink);
//                }
//            });

//            var resolved = false;
//            return new Promise((resolve) => {
//                on.once(dialog, "execute", function () {
//                    resolved = true;
//                    resolve(contentSelector.get("value"));
//                });

//                on.once(dialog, "hide", function () {
//                    if (!resolved) {
//                        resolve("");
//                    }
//                });

//                dialog.show();
//            });
//        }

//        function replaceReferences(selectedContentLink, container, sourceContentLink) {
//            createDialog(container).then((contentLink) => {
//                if (!contentLink) {
//                    return;
//                }

//                lastSelectedLink = contentLink;

//                var updateParameters = {
//                    sourceReference: sourceContentLink,
//                    targetReference: contentLink
//                };

//                // when empty then run Replace All
//                if (selectedContentLink) {
//                    updateParameters.sourceContentLinkToReplace = selectedContentLink;
//                }

//                var registry = dependency.resolve("epi.storeregistry");
//                var store = registry.get("app.updatereferences");
//                store.add(updateParameters).then(function () {
//                    container.fetchData();
//                });
//            });
//        }

//        function patchStartup() {
//            var originalStartup = ContentReferences.prototype.startup;
//            ContentReferences.prototype.startup = function () {
//                lastSelectedLink = null;

//                var result = originalStartup.apply(this, arguments);

//                var self = this;
//                this.grid.on(".dgrid-column-uri a.link-replace:click", function (e) {
//                    e.preventDefault();
//                    e.stopPropagation();

//                    var selectedContentLink = Object.keys(self.grid.selection)[0];

//                    var sourceContentLink = self.model.contentItems[0].contentLink;

//                    replaceReferences(selectedContentLink, self, sourceContentLink);
//                });

//                this.grid.columns.uri.className = "epi-width20"

//                return result;
//            }
//            ContentReferences.prototype.startup.nom = "startup";
//        }

//        // do not change context when click on Replace link
//        function patchChangeContext() {
//            var originalChangeContext = ContentReferences.prototype._onChangeContext;
//            ContentReferences.prototype._onChangeContext = function (e) {
//                if (e.target.classList.contains("link-replace")) {
//                    return;
//                }
//                return originalChangeContext.apply(this, arguments);
//            }
//            ContentReferences.prototype._onChangeContext.nom = "_onChangeContext";
//        }

//        // add Replace link to grid
//        function patchGetLinkTemplate() {
//            var orignalGetTemplateLink = ContentReferences.prototype._getLinkTemplate;
//            ContentReferences.prototype._getLinkTemplate = function () {
//                var result = orignalGetTemplateLink.apply(this, arguments);

//                var replaceLink = document.createElement("a");
//                replaceLink.classList.add("epi-visibleLink");
//                replaceLink.classList.add("link-replace");
//                replaceLink.innerHTML = resources.replace;
//                replaceLink.title = "Replace usage with another link";
//                replaceLink.style.marginLeft = "8px";

//                return "<div>" + result + replaceLink.outerHTML + "</div>";
//            }
//            ContentReferences.prototype._getLinkTemplate.nom = "_getLinkTemplate";
//        }

//        // add additional dialog button that allows to replace all references
//        function patchDialog() {
//            var origianlGetActions = Dialog.prototype.getActions;
//            Dialog.prototype.getActions = function () {
//                var self = this;

//                var result = origianlGetActions.apply(this, arguments);

//                if (this.dialogClass === "epi-dialog-contentReferences") {
//                    var replaceButton = {
//                        name: "Replace All",
//                        label: "Replace All",
//                        title: null,
//                        action: function () {
//                            // find grid widget
//                            var contentReferencesWidget = dijitRegistry.getEnclosingWidget(self.containerNode).getChildren()[0];
//                            var selectedContentLink = contentReferencesWidget.contentItems[0].contentLink;
//                            replaceReferences(null, contentReferencesWidget, selectedContentLink);
//                        }
//                    }
//                    return [result[0], replaceButton, result[1]];
//                }

//                return result;
//            }
//            Dialog.prototype.getActions.nom = "getActions";
//        }

//        // initialize store for updating references
//        function initializeStore() {
//            var registry = dependency.resolve("epi.storeregistry");
//            registry.add("app.updatereferences",
//                new JsonRest({
//                    target: routes.getRestPath({ moduleArea: "app", storeName: "content-reference-update" })
//                })
//            );
//        }

//        return declare([_Module], {
//            // summary: Module initializer for the default module.
//            initialize: function () {
//                this.inherited(arguments);

//                initializeStore();
//                patchStartup();
//                patchChangeContext();
//                patchGetLinkTemplate();
//                patchDialog();
//            }
//        });
//    });