/**
 * A dialog that displays artifacts to choose from and a tree
 * of workspace/projects to use as the target to copy to.
 *
 *     @example
 *     Ext.create('Rally.technicalservices.dialog.CopyDialog', {
 *         artifactTypes: ['userstory', 'portfolioitem/feature'],
 *         autoShow: true,
 *         height: 250,
 *         title: 'Choose User Stories',
 *         listeners: {
 *             artifactchosen: function(dialog, selectedRecord){
 *                 Ext.Msg.alert('Chooser', selectedRecord.get('Name') + ' was chosen');
 *             },
 *             scope: this
 *         }
 *      });
 */
Ext.define('Rally.technicalservices.dialog.CopyDialog', {
    requires: [
        'Ext.data.Store',
        'Rally.data.ModelFactory',
        'Rally.data.wsapi.Filter',
        'Rally.ui.Button',
        'Rally.ui.EmptyTextFactory',
        'Rally.ui.grid.Grid',
        'Rally.ui.selection.CheckboxModel',
        'Rally.util.Ref'
    ],
    extend: 'Rally.ui.dialog.Dialog',
    alias: 'widget.rallycopydialog',

    clientMetrics: [
        {
            method: '_search',
            description: 'chooser search performed'
        },
        {
            event: 'artifactchosen',
            description: 'artifact chosen'
        }
    ],

    height: 400,
    width: 600,
    layout: 'fit',
    closable: true,
    draggable: true,

    config: {
        /**
         * @cfg {String}
         * Title to give to the dialog
         */
        title: 'Choose an Artifact',
        /**
         * @cfg {Array} (required)
         * List of artifact types to allow the user to choose from
         */
        artifactTypes: [],
        /**
         * @cfg {Boolean}
         * Allow multiple selection or not
         */
        multiple: false,

        /**
         * @cfg {Object}
         * An {Ext.data.Store} config object used when building the grid
         * Handy when you need to limit the selection with store filters
         */
        storeConfig: {
            context: {
                project: null
            },
            sorters: [
                {
                    property: 'FormattedID',
                    direction: 'DESC'
                }
            ]
        },

        /**
         * @cfg {Ext.grid.Column}
         * List of columns that will be used in the chooser
         */
        columns: [
            {
                text: 'ID',
                dataIndex: 'FormattedID',
                renderer: _.identity
            },
            'Name'
        ],

        /**
         * @cfg {String}
         * Text to be displayed on the button when selection is complete
         */
        selectionButtonText: 'Done',

        /**
         * @cfg {Object}
         * The grid configuration to be used when creative the grid of items in the dialog
         */
        gridConfig: {},

        /**
         * @deprecated
         * @cfg {String}
         * The ref of a record to select when the chooser loads
         * Use selectedRecords instead
         */
        selectedRef: undefined,

        /**
         * @cfg {String}|{String[]}
         * The ref(s) of items which should be selected when the chooser loads
         */
        selectedRecords: undefined,

        /**
         * @cfg {Array}
         * The records to select when the chooser loads
         */
        initialSelectedRecords: undefined,

        /**
         * @private
         * @cfg userAction {String} (Optional)
         * The client metrics action to record when the user makes a selection and clicks done
         */

        /**
         * @cfg showRadioButtons {Boolean}
         */
        showRadioButtons: true
    },

    constructor: function(config) {
        this.mergeConfig(config);

        this.callParent([this.config]);
    },

    selectionCache: [],

    initComponent: function() {
        this.callParent(arguments);

        this.addEvents(
            /**
             * @event artifactchosen
             * Fires when user clicks done after choosing an artifact
             * @param {Rally.ui.dialog.ArtifactChooserDialog} source the dialog
             * @param {Rally.data.wsapi.Model}| {Rally.data.wsapi.Model[]} selection selected record or an array of selected records if multiple is true
             */
            'artifactchosen'
        );

        this.addCls(['chooserDialog', 'chooser-dialog']);
    },

    destroy: function() {
        this._destroyTooltip();
        this.callParent(arguments);
    },

    beforeRender: function() {
        this.callParent(arguments);

        this.addDocked({
            xtype: 'toolbar',
            dock: 'bottom',
            padding: '0 0 10 0',
            layout: {
                type: 'hbox',
                pack: 'center'
            },
            ui: 'footer',
            items: [
                {
                    xtype: 'rallybutton',
                    itemId: 'doneButton',
                    text: this.selectionButtonText,
                    cls: 'primary rly-small',
                    scope: this,
                    disabled: true,
                    userAction: 'clicked done in dialog',
                    handler: function() {
                        this.fireEvent('artifactchosen', this, this.getSelectedRecords());
                        this.close();
                    }
                },
                {
                    xtype: 'rallybutton',
                    text: 'Cancel',
                    cls: 'secondary rly-small',
                    handler: this.close,
                    scope: this,
                    ui: 'link'
                }
            ]
        });

        var top_items = [];
                
        //if (this.introText) {
        //    top_items.push({
        //        xtype: 'component',
        //        componentCls: 'intro-panel',
        //        padding: 5,
        //        html: this.introText
        //    });
        //}
        
        var picker = Ext.create('Rally.ui.picker.project.ProjectPicker',{
            itemId: 'project_picker',
            fieldLabel:this.introText,
            labelAlign: 'top',
            width: '100%',
            dock: 'top',
            border: false,
            padding: '0 0 10px 0',
            showMostRecentlyUsedProjects: true,
            listeners: {
                change: function(picker,record,options) {
                    this.target_project = picker.getSelectedRecord().getData();
                    this.target_workspace = this.target_project.Workspace;

                    this._enableDoneButton();
                },
                scope: this
            }
        });

        this.addDocked(picker);
       // top_items.push(picker);
        
        this.addDocked({
            xtype:'container',
            items:top_items
        });

        this.addDocked({
            xtype: 'toolbar',
            itemId: 'searchBar',
            dock: 'top',
            border: false,
            padding: '0 0 10px 0',
            items: this.getSearchBarItems()
        });

        this.buildGrid();

        this.selectionCache = this.getInitialSelectedRecords() || [];
    },

    /**
     * Get the records currently selected in the dialog
     * {Rally.data.Model}|{Rally.data.Model[]}
     */
    getSelectedRecords: function() {
        var selectedRecords = this.multiple ? this.selectionCache : this.selectionCache[0];
        
        var selectedValue = {
            selectedRecords: selectedRecords,
            targetProject: this.target_project,
            targetWorkspace: this.target_workspace
        };

        return selectedValue;
    },

    getGridModels: function() {
        return this.artifactTypes;
    },

    getSearchBarItems: function() {
        return [
            {
                xtype: 'triggerfield',
                cls: 'rui-triggerfield chooser-search-terms',
                emptyText: 'Search Keyword or ID',
                enableKeyEvents: true,
                flex: 1,
                itemId: 'searchTerms',
                listeners: {
                    keyup: function (textField, event) {
                        if (event.getKey() === Ext.EventObject.ENTER) {
                            this._search();
                        }
                    },
                    afterrender: function (field) {
                        field.focus();
                    },
                    scope: this
                },
                triggerBaseCls: 'icon-search chooser-search-icon'
            }
        ];
    },

    getStoreFilters: function() {
        return [];
    },

    buildGrid: function() {
        if (this.grid) {
            this.grid.destroy();
        }

        var me = this;
        var selectionConfig = {
            mode: this.multiple ? 'SIMPLE' : 'SINGLE',
            allowDeselect: true
        };
        this.grid = Ext.create('Rally.ui.grid.Grid', Ext.Object.merge({
            autoAddAllModelFieldsAsColumns: false,
            columnCfgs: this.columns,
            enableEditing: false,
            enableColumnHide: false,
            enableColumnMove: false,
            model: this.getGridModels(),
            selModel: this.showRadioButtons || this.multiple ? Ext.create('Rally.ui.selection.CheckboxModel', Ext.apply(selectionConfig, {
                enableKeyNav: false,
                isRowSelectable: function (record) {
                    return me._isArtifactEditable(record);
                }
            })) : Ext.create('Ext.selection.RowModel', selectionConfig),
            showRowActionsColumn: false,
            storeConfig: this._getStoreConfig(),
            viewConfig: {
                emptyText: Rally.ui.EmptyTextFactory.get('defaultText'),
                publishLoadMessages: false,
                getRowClass: function (record) {
                    return Rally.util.Test.toBrowserTestCssClass('row', record.getId()) + (me._isArtifactEditable(record) ? ''  : ' disabled-row');
                }
            }
        }, this.config.gridConfig));
        this.mon(this.grid, {
            beforeselect: this._onGridSelect,
            beforedeselect: this._onGridDeselect,
            load: this._onGridLoad,
            scope: this
        });
        this.add(this.grid);
        this._onGridReady();
    },

    _addTooltip: function() {
        this._destroyTooltip();
        this.tooltip = Ext.create('Rally.ui.tooltip.ToolTip', {
            target: this.grid.getEl(),
            html: 'You don\'t have permission to edit this item.',
            delegate: '.disabled-row',
            anchor: 'top',
            showDelay: 0,
            showOnClick: true
        });
    },

    _destroyTooltip: function() {
        if (this.tooltip) {
            this.tooltip.destroy();
        }
    },

    _getStoreConfig: function() {
        var storeConfig = _.cloneDeep(this.getInitialConfig().storeConfig);

        if (this._getSearchTerms()) {
            storeConfig.search = this._getSearchTerms();
        }

        storeConfig.filters = (storeConfig.filters || []).concat(this.getStoreFilters());
        return storeConfig;
    },

    _enableDoneButton: function() {
        
        if ( this.target_project && this.selectionCache.length > 0 ) {
            this.down('#doneButton').setDisabled(false);
        }
    },

    _findRecordInSelectionCache: function(record){
        return _.findIndex(this.selectionCache, function(cachedRecord) {
            return cachedRecord.get('_ref') === record.get('_ref');
        });
    },

    _onGridSelect: function(selectionModel, record) {
        if (!this._isArtifactEditable(record)) {
            return;
        }

        var index = this._findRecordInSelectionCache(record);
        if (index === -1) {
            if (!this.multiple) {
                this.selectionCache = [];
            }
            this.selectionCache.push(record);
        }

        this._enableDoneButton();
    },

    _onGridDeselect: function(selectionModel, record) {
        var index = this._findRecordInSelectionCache(record);
        if (index !== -1) {
            this.selectionCache.splice(index, 1);
        }

        this._enableDoneButton();
    },

    _onGridReady: function() {
        if (!this.grid.rendered) {
            this.mon(this.grid, 'afterrender', this._onGridReady, this, {single: true});
            return;
        }

        if (this.grid.getStore().isLoading()) {
            this.mon(this.grid, 'load', this._onGridReady, this, {single: true});
            return;
        }

        this._onGridLoad();
        this.center();
    },

    _isArtifactEditable: function(record) {
        return Rally.environment.getContext().getPermissions().isProjectEditor(record.get('Project'));
    },

    _onGridLoad: function() {
        var defaultSelection = Ext.Array.from(this.selectedRef || this.selectedRecords);
        if (defaultSelection.length) {
            var selectedRecords = _.compact(_.map(defaultSelection, function(ref) {
                var recordIndex = this.grid.getStore().find('_ref', ref);
                return recordIndex >= 0 ? this.grid.getStore().getAt(recordIndex) : null;
            }, this));
            if(selectedRecords.length) {
                this.grid.getSelectionModel().select(selectedRecords);
            }
        } else {
            var store = this.grid.store;
            var records = [];

            _.each(this.selectionCache, function(record) {
                var recordIndex = store.find('_ref', record.get('_ref'));

                if (recordIndex !== -1) {
                    var storeRecord = store.getAt(recordIndex);
                    records.push(storeRecord);
                }
            });

            if (records.length) {
                this.grid.getSelectionModel().select(records);
            }
        }

        this._addTooltip();
        if (Rally.BrowserTest) {
            Rally.BrowserTest.publishComponentReady(this);
        }
    },

    _search: function() {
        var terms = this._getSearchTerms();
        var store = this.grid.getStore();
        if (terms) {
            store.search = terms;
        } else {
            delete store.search;
        }
        store.loadPage(1);
    },

    _getSearchTerms: function() {
        var textBox = this.down('#searchTerms');
        return textBox && textBox.getValue();
    }
});