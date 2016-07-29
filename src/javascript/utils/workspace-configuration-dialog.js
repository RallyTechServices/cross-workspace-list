Ext.define('CArABU.technicalservices.WorkspaceConfigurationDialog', {
    extend: 'Rally.ui.dialog.Dialog',
    alias: 'widget.workspaceconfigdialog',

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
        title: 'Choose an Item',

        /**
         * @cfg {Boolean}
         * Allow multiple selection or not
         */
        multiple: true,

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
                dataIndex: 'ObjectID',
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
        showRadioButtons: true,

        introText:  "Please select a workspace, Link Field and appropriate mappings for each mapping type in the selected workspace.",

    },
    constructor: function(config) {

        this.workspaces = config.workspaces;
        this.workspaceConfig = config.workspaceConfig || {};

        if (config.selectedWorkspaceStore){
            this.selectedWorkspaceStore = config.selectedWorkspaceStore
        }

        this.mergeConfig(config);
        this.callParent([this.config]);
    },

    initComponent: function() {
        this.callParent(arguments);

        this.addEvents(
            /**
             * @event artifactchosen
             * Fires when user clicks done after choosing an artifact
             * @param {Rally.ui.dialog.ArtifactChooserDialog} source the dialog
             * @param {Rally.data.wsapi.Model}| {Rally.data.wsapi.Model[]} selection selected record or an array of selected records if multiple is true
             */
            'saveconfiguration'
        );

        this.addCls(['chooserDialog', 'chooser-dialog']);
    },

    destroy: function() {
        //      this._destroyTooltip();
        this.callParent(arguments);
    },
    /**
     * getConfiguration
     * returns the configuration currently in the dialog
     */
    getConfiguration: function(){
       return {};
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
                    disabled: false,
                    userAction: 'clicked done in dialog',
                    handler: this._done
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

        if (this.introText) {
            this.addDocked({
                xtype: 'component',
                itemId: 'intro-text',
                componentCls: 'intro-panel',
                html: this.introText
            });
        }

        this.addDocked({
            xtype: 'toolbar',
            itemId: 'workspaceSelector',
            dock: 'top',
            layout: 'vbox',
            border: false,
            padding: '0 0 10px 0',
            items: this.getWorkspaceSelectorItems()
        });

        if (this.selectedWorkspaceStore){
            CArABU.technicalservices.WorkspaceSettingsUtility.initializeWorkspaceConfiguration(this.selectedWorkspaceStore).then({
                success: this._initializeDialog,
                failure: this._initializeDialogWithError,
                scope: this
            });
        }
    },
    _done: function(){
        var linkField = this.down('#cb-linkField') && this.down('#cb-linkField').getValue(),
            intro = this.down('#intro-text');

        this._saveMappings();

        this.selectedWorkspaceStore.linkField = linkField;

        var validationErrors = CArABU.technicalservices.WorkspaceSettingsUtility.validateSetting(this.selectedWorkspaceStore,this._getTotalPortfolioItemLevels());
     //  var validationErrors = this.selectedWorkspaceStore.validateConfiguration(this._getTotalPortfolioItemLevels());
        if (validationErrors && validationErrors.length > 0){
            intro.update('<div class="warning">' + validationErrors.join('<br/>') + '</div>');
            return;
        }
        this.fireEvent('saveconfiguration', this.selectedWorkspaceStore);
        this.close();
    },
    /**
     * Get the records currently selected in the dialog
     * {Rally.data.Model}|{Rally.data.Model[]}
     */
    getSelectedRecords: function() {
        return this.multiple ? this.selectionCache : this.selectionCache[0];
    },

    getWorkspaceSelectorItems: function() {
        var width = 300,
            disabled = this.selectedWorkspaceStore && this.selectedWorkspaceStore.ObjectID > 0,
            linkValue = this.selectedWorkspaceStore && this.selectedWorkspaceStore.linkField || null;

        var items = [{
            xtype: 'rallycombobox',
            itemId: 'cb-linkField',
            fieldLabel: 'Link Field',
            labelAlign: 'right',
            width: width,
            store: Ext.create('Rally.data.custom.Store',[]),
            displayField: 'displayName',
            valueField: 'name',
            value: linkValue,
            allowNoEntry: false,
            disabled: true
        }];

        if (disabled){
            items.unshift({
                xtype: 'rallytextfield',
                disabled: true,
                fieldLabel: 'Workspace',
                labelAlign: 'right',
                value: this.selectedWorkspaceStore.Name,
                width: width
            });
        } else {
            items.unshift({
                xtype:'rallycombobox',
                itemId: 'cb-workspace',
                fieldLabel: 'Workspace',
                labelAlign: 'right',
                store: Ext.create('Rally.data.custom.Store',{ data: this.workspaces }),
                displayField: 'Name',
                valueField: 'ObjectID',
                allowNoEntry: true,
                noEntryText: 'Select a Workspace...',
                width: width,
                listeners: {
                scope: this,
                    select: this._initializeWorkspace,
                    ready: this._initializeWorkspace
            }
            });
        }

        return items;

    },
    _initializeWorkspace: function(cb){
        if (cb && cb.getRecord() && cb.getRecord().get('ObjectID') > 0){
            var workspaceRef = cb.getRecord().get('_ref'),
                workspaceOid = cb.getRecord().get('ObjectID'),
                workspaceName = cb.getRecord().get('Name');

            if (CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash[workspaceOid]){
                this._initializeDialog(CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash[workspaceOid]);
            } else {
                CArABU.technicalservices.WorkspaceSettingsUtility.initializeWorkspaceConfiguration({
                    _ref: workspaceRef,
                    Name: workspaceName,
                    ObjectID: workspaceOid
                }).then({
                    success: this._initializeDialog,
                    failure: this._initializeDialogWithError,
                    scope: this
                });
            }
        } else {
            this.down('#cb-linkField').bindStore(null);
            this.down('#cb-linkField').setDisabled(true);
        }
    },
    _initializeDialog: function(otherWorkspaceStore){
        this.selectedWorkspaceStore = otherWorkspaceStore || null;
        if (this.selectedWorkspaceStore){
            this._updateLinkFieldSelector(this.selectedWorkspaceStore);
            this._buildMappingGrid(this.selectedWorkspaceStore);
        }
    },
    _initializeDialogWithError: function(errorMsg){

    },
    _getTotalPortfolioItemLevels: function(){

        if (this.selectedWorkspaceStore){
            return Math.min(
                CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspacePortfolioItemTypes().length,
                this.selectedWorkspaceStore.portfolioItemTypes.length);
        }
        return CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspacePortfolioItemTypes().length;
    },
    _updateLinkFieldSelector: function(otherWorkspaceStore){
        var store = Ext.create('Rally.data.custom.Store',{
            data: CArABU.technicalservices.WorkspaceSettingsUtility.getValidLinkFields(otherWorkspaceStore)
        });
        this.down('#cb-linkField').bindStore(store);
        this.down('#cb-linkField').setDisabled(false);
        if (this.selectedWorkspaceStore.linkField){
            this.down('#cb-linkField').setValue(this.selectedWorkspaceStore.linkField);
        }
    },

    _saveMappings: function(){
        var otherWorkspace = this.selectedWorkspaceStore,
            grid = this.down('rallygrid');

        if (grid && otherWorkspace){
            var mappings = otherWorkspace.mappings || {};

            Ext.Array.each(grid.getStore().getRange(), function(r){

                var mappedType = r.get('type'),
                    mappedField = 'State',
                    mapFromValue = r.get('mapFrom'),
                    mapToName = r.get('mapTo'),
                    mapToValue = null;

                var otherMappedType = CArABU.technicalservices.WorkspaceSettingsUtility.getDestinationModelType(mappedType, {workspace: otherWorkspace._ref}, otherWorkspace).toLowerCase();

                if (_.has(otherWorkspace.portfolioItemStates[otherMappedType], mapToName)){
                    mapToValue = mapToName;
                }
                //We are saving items with the current workspace type for mapping.
                mappedType = mappedType.toLowerCase();
                mappings[mappedType] = mappings[mappedType] || {};
                mappings[mappedType][mappedField] = mappings[mappedType][mappedField] || {};
                mappings[mappedType][mappedField][mapFromValue] = mapToValue;

            }, this);
         //   console.log('otherWorkspacemappings', mappings);
            otherWorkspace.mappings = mappings;
        }
    },

    _buildMappingGrid: function(){
        var currentWorkspace = CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspace(),
            otherWorkspace = this.selectedWorkspaceStore,
            totalPortfolioLevels = this._getTotalPortfolioItemLevels();

        var data = [];
        for (var i=0; i < totalPortfolioLevels; i++){
            var currentType = currentWorkspace.portfolioItemTypes[i].toLowerCase(),
                otherType = otherWorkspace.portfolioItemTypes[i];

            Ext.Object.each(currentWorkspace.portfolioItemStates[currentType], function(stateName, ref){

                if (stateName) {
                    var mappedStateName = otherWorkspace.mappings &&
                        otherWorkspace.mappings[currentType] &&
                        otherWorkspace.mappings[currentType]['State'] &&
                        otherWorkspace.mappings[currentType]['State'][stateName] || "";

                    data.push({
                        type: currentType,
                        otherType: otherType,
                        mapFrom: stateName,
                        mapTo: mappedStateName
                    });
                }
            }, this);
        }

        this.add({
            xtype: 'rallygrid',
            store: Ext.create('Rally.data.custom.Store',{
                data: data
            }),
            showRowActionsColumn: false,
            showPagingToolbar: false,
            columnCfgs: this._getMappingGridColumnCfgs( this._getPortfolioStateOptions(otherWorkspace))
        });
    },
    _getPortfolioStateOptions: function(otherWorkspace){
        var data = [];
        Ext.Object.each(otherWorkspace.portfolioItemStates, function(type, states){
            Ext.Object.each(states, function(stateName, stateRef){
                if (stateName  && !Ext.Array.contains(data, stateName)){
                    data.push(stateName);
                }
            });
        });
        return _.map(data, function(r){
            return {_refObjectName: r};
        });
    },
    _getMappingGridColumnCfgs: function(mapToStateOptions){

        return [{
            dataIndex: 'type',
            text: 'type',
            renderer: function(v,m,r){
                return r.get('otherType').replace('PortfolioItem/','');
                //var string = v.replace('portfolioitem/','');
                //return string.charAt(0).toUpperCase() + string.slice(1);
            }
        },{
            dataIndex: 'mapFrom',
            text: 'Map From'
        },{
            dataIndex: 'mapTo',
            text: 'Map To',
            editor: {
                    xtype: 'rallycombobox',
                    allowNoEntry: true,
                    store: Ext.create('Rally.data.custom.Store',{
                        data: mapToStateOptions
                    }),
                    valueField: '_refObjectName',
                    displayField: '_refObjectName'
                }
        }];
    }
});
