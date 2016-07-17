Ext.define("cross-workspace-list", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    integrationHeaders : {
        name : "cross-workspace-list"
    },

    items: [
        {xtype:'container',itemId:'selector_box', layout: 'hbox'},
        {xtype:'container',itemId:'display_box'}
    ],
    config: {
        defaultSettings: {
            fieldsToCopy: ['Name','Description','PlanEstimate','ScheduleState'],
            fieldsToUpdate: ['Name','Description','PlanEstimate','ScheduleState'],
            gridFields: ['FormattedID','Name','ScheduleState','PlanEstimate'],
            copyFields: ['Name','ScheduleState','Description','PlanEstimate','State','PlannedStartDate','PlannedEndDate'],
            workspaceSettings: "{}"
        }
    },

    sourcePortfolioItemTypes: [],
    workspaceSettings: null,

    launch: function() {

        CArABU.technicalservices.WorkspaceSettingsUtility.context = this.getContext();

        this.logger.log('launch', this.getSetting('workspaceSettings'));
        this._initializeWorkspaceSettingsHash(this.getSettings());
    },
    /**
     * Initializes the current workspace settings, loading in the link field, as well as the states and
     * portfolio item types.
     * @returns {Deft.Deferred}
     * @private
     */
    _initializeWorkspaceSettingsHash: function(settings){
        this.logger.log('_initializeWorkspaceSettingsHash', settings, settings.workspaceSettings);

        CArABU.technicalservices.WorkspaceSettingsUtility.initializeWorkspaceSettingsHash(settings.workspaceSettings, this.getContext(), settings.link_field).then({
            success: function(workspaceSettingsHash){
                this.logger.log('_initializeWorkspaceSettingsHash SUCCESS', workspaceSettingsHash);
                //CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash = workspaceSettingsHash;
                //this.workspaceSettingsHash = workspaceSettingsHash;
                this._addSelectors();
            },
            failure: function(errorMsg){
                this.logger.log('_initializeWorkspaceSettingsHash FAILURE', errorMsg);
                Rally.ui.notify.Notifier.showError({
                    message: "Error initializing workspace settings: " + errorMsg
                });

            },
            scope: this
        });


        //this.workspaceSettings = Ext.create('CArABU.technicalservices.WorkspaceSettings',{
        //    context: this.getContext()
        //});
        //this.workspaceSettings.on('ready', this._addSelectors, this);
        //this.logger.log('workspace settings', this.getSetting('workspaceSettings'));
        //this.workspaceSettings.initialize(this._getDecodedWorkspaceSettings(), this.getSetting('link_field') || "");
    },
    getWorkspaceSettingsHash: function(){
        return CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash;
    },
    _addSelectors: function() {

        this.down('#display_box').removeAll();

       // var destinationWorkspaces = this.workspaceSettings && this.workspaceSettings.getDestinationWorkspaces() || [];
        this.logger.log('_addSelectors',this.getWorkspaceSettingsHash());
        var destinationWorkspaces = CArABU.technicalservices.WorkspaceSettingsUtility.getDestinationWorkspaceConfigurations(this.getWorkspaceSettingsHash()) || [];
        if (destinationWorkspaces.length === 0  || this.getSetting('link_field') == "") {
            this.down('#display_box').add({
                xtype: 'container',
                html: 'Use the "App Settings..." menu choice to configure this app'
            });
            return;
        }

        var validLinkFields = CArABU.technicalservices.WorkspaceSettingsUtility.getValidLinkFields(),
            validLinkFieldNames = _.map(validLinkFields, function(f){ return f.name; });
        if (!Ext.Array.contains(validLinkFieldNames, this.getSetting('link_field'))){
            var validLinkFieldDisplayNames = _.map(validLinkFields, function(f){ return f.displayName; });

            if (validLinkFieldDisplayNames.length === 0){
                this.down('#display_box').add({
                    xtype: 'container',
                    html: 'The selected link field does not exist for all required objects. <br/><br/> Ask your workspace administrator to configure a custom String field with the same name for Portfolio Item, User Story and Task objects to be used as the Link Field.  Then use the "App Settings..." menu choice to select the link field that exists for all copyable types.'
                });
            } else {
                this.down('#display_box').add({
                    xtype: 'container',
                    html: 'The selected link field does not exist for all required objects. <br/><br/> Use the "App Settings..." menu choice to select a link field that exists for all copyable types.  Valid link fields are: <br/>' + validLinkFieldDisplayNames.join('<br/>')
                });
            }

            return;
        }

        var container = this.down('#selector_box');
        var cb = container.add({
            xtype: 'rallycombobox',
            itemId: 'cbType',
            fieldLabel: 'Display Type',
            labelAlign: 'right',
            width: 300,
            margin: 5,
            storeConfig: {
                autoLoad: true,
                model: 'TypeDefinition',
                fetch: ['TypePath','DisplayName','Ordinal'],
                filters: this.getTypeFilters(),
                remoteFilter: true,
                listeners: {
                    load: this._updateView,
                    scope: this
                }
            },
            valueField: 'TypePath',
            displayField: 'DisplayName'
        });
        cb.on('select', this._updateView, this);
        // cb.on('ready', this._updateView, this);

        //var btn = container.add({
        //    xtype: 'rallybutton',
        //    enableToggle: true,
        //    itemId: 'btToggleState',
        //    margin: 5,
        //    iconCls: 'icon-link'
        //});


        var syncBtn = container.add({
            xtype: 'rallybutton',
            itemId: 'btSync',
            iconCls: 'icon-refresh',
            margin: 5
        });

//        btn.on('toggle', this._toggleView, this);
        syncBtn.on('click', this._sync, this);

    },
    //_toggleView: function(btn){
    //    var allowSync = !btn.pressed,
    //        syncBtn = this.getSyncButton();
    //
    //    this.logger.log('_toggleView', allowSync, syncBtn);
    //
    //    if (btn.pressed){
    //        btn.removeCls('primary')
    //        btn.addCls('secondary')
    //    } else {
    //        btn.removeCls('secondary')
    //        btn.addCls('primary')
    //    }
    //    if (syncBtn) { syncBtn.setDisabled(allowSync); }
    //
    //    this._updateView();
    //},
    _updateView: function(){
        var type = this.getArtifactType(),
            showLinkedItems = this.showLinkedItemsOnly();

        this.logger.log('_updateView', type, showLinkedItems);

        //Todo, filter out only synced items...If synced only is on, there are a couple of different behaviors:
        // (1) only show items that are synced (starting at the highest level they are synced) - this will result in a mixed hierarchy
        // (2) only show items for the selected type that are synced. -- this is easiest but need to ask about it....

        Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
            models: [type],
            enableHierarchy: true,
            fetch: this.getFetchList(type),
            filters: this.getFilters()
        }).then({
            success: this._createTreeGrid,
            scope: this
        });

    },
    _sync: function(){

        var sourceRecords= [], //Todo handle paging
            linkField = this.getLinkField();

        this.down('rallygridboard').getGridOrBoard().getStore().each(function(r){
            if (r.get(linkField)){
                sourceRecords.push(r);
            }
        });

        this.logger.log('_sync', sourceRecords);

        var loader = Ext.create('CArABU.technicalservices.ArtifactLoader',{
            loadLinkedItems: true,
            workspaceSettings: this.getWorkspaceSettingsHash(),
            linkField: CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspaceLinkField(),
            copyFields: CArABU.technicalservices.WorkspaceSettingsUtility.copyFields.concat(['LastUpdateDate',linkField]),
            listeners: {
                loaderror: function(error){
                    this.logger.log('loaderror',error);
                    Rally.ui.notify.Notifier.showError({message: error});
                },
                loadcomplete: function(records){
                    this.logger.log('loadcomplete',records);
                    this.syncRecords(records);
                },
                scope: this
            }
        });
        loader.loadHierarchy(sourceRecords);

    },

    getLinkField: function(){
        return this.getSetting('link_field');
    },
    getGridFields: function(){
        //Todo make sure this is returned as an array in Rally
        return this.getSetting('gridFields') || [];
    },
    getTypeFilters: function(){
        var filters = Rally.data.wsapi.Filter.or([{
            property: 'TypePath',
            value: 'HierarchicalRequirement'
        },{
            property: 'TypePath',
            operator: 'contains',
            value: 'PortfolioItem/'
        }]);
        return filters;
    },
    getArtifactType: function(){
        return this.down('#cbType') && this.down('#cbType').getValue() || null;
    },
    showLinkedItemsOnly: function(){
        return this.down('#btToggleState') && this.down('#btToggleState').pressed;
    },
    getSyncButton: function(){
        return this.down('#btSync');
    },
    getFetchList: function(type){
        //Todo this will come from the workspace mapper or configurations at some point...
        var fetch = ['FormattedID','Name'].concat([this.getLinkField()]);
        if (type === 'HierarchicalRequirement'){
            fetch = fetch.concat['ScheduleState'];
        } else { //Portfolio Items
            fetch = fetch.concat['State','PlannedStartDate','PlannedEndDate'];
        }
        return fetch;
    },
    getColumnCfgs: function(type){
        var cols = ['Name',this.getLinkField()];
        if (type === 'HierarchicalRequirement'){
            cols = cols.concat(['ScheduleState']);
        } else { //Portfolio Items
            cols = cols.concat(['State','PlannedStartDate','PlannedEndDate']);
        }
        this.logger.log('columnCfgs', cols);
        return cols;
    },

    getFieldsToCopy: function(){
        return ['Name','ScheduleState','Description','PlanEstimate','State','PlannedStartDate','PlannedEndDate'];
    },
    getFilters: function(){
        if (this.showLinkedItemsOnly()){
            return [{
                property: this.getLinkField(),
                operator: "contains",
                value: "href"
            }];
        }
        return [];
    },
    getNoDataPrimaryText: function(){
        if (this.showLinkedItemsOnly()){
            return "No linked work items were found.";
        }
        return null;
    },
    getNoDataSecondaryText: function(){
        if (this.showLinkedItemsOnly()){
            return "No linked work items were found for the selected type in the current workspace and project scope.";
        }
        return null;
    },
    getWorkspaces: function(){
        this.logger.log('getWorkspaces', this.sourcePortfolioItemTypes);
        if (!this.workspaceSettings){
            this.workspaceSettings = Ext.create('CArABU.technicalservices.WorkspaceSettings',{
                sourcePortfolioItemTypes: this.sourcePortfolioItemTypes,
                context: this.getContext()
            });
        }
        return this.workspaceSettings;
    },
    _createTreeGrid: function(store){

        var box = this.down('#display_box'),
            type = this.getArtifactType();
        if (!box){
            this.logger.log('No Display Box -- somethings wrong.');
            return;
        }
        box.removeAll();
        //store.load();
        box.add({
            xtype: 'rallygridboard',
            context: this.getContext(),
            modelNames: [type],
            toggleState: 'grid',
            gridConfig: {
                store: store,
                storeConfig: {
                    pageSize: 200
                },
                noDataPrimaryText: this.getNoDataPrimaryText(),
                noDataSecondaryText: this.getNoDataSecondaryText(),
                columnCfgs: this.getColumnCfgs(type),
                bulkEditConfig: {
                    items: [{
                        xtype: 'bulkmenuitemxworkspacecopy' ,
                        linkField: this.getLinkField(),
                        typesToCopy: CArABU.technicalservices.WorkspaceSettingsUtility.getCopyableTypes(type, this.getContext()),
                        copyFields: CArABU.technicalservices.WorkspaceSettingsUtility.copyFields,
                        workspaceSettings: this.getWorkspaceSettingsHash(),
                        context: this.getContext()
                    },{
                        xtype: 'bulkmenuitemxworkspacedeepcopy' ,
                        linkField: this.getLinkField(),
                        typesToCopy: CArABU.technicalservices.WorkspaceSettingsUtility.getCopyableTypes(type, this.getContext()),
                        copyFields: CArABU.technicalservices.WorkspaceSettingsUtility.copyFields,
                        workspaceSettings: this.getWorkspaceSettingsHash(),
                        context: this.getContext()
                    }]
                }
            },
            plugins: [{
                ptype: 'rallygridboardfieldpicker',
                headerPosition: 'left',
                modelNames: [type],
                stateful: true,
                stateId: this.getContext().getScopedStateId('columns')
            },{
                ptype: 'rallygridboardinlinefiltercontrol',
                inlineFilterButtonConfig: {
                    stateful: true,
                    stateId: this.getContext().getScopedStateId('filters'),
                    modelNames: [type],
                    inlineFilterPanelConfig: {
                        quickFilterPanelConfig: {
                            defaultFields: [
                                'ArtifactSearch',
                                'Owner',
                                'ModelType'
                            ]
                        }
                    }
                }
            }],
            height: this.getHeight()
        });
    },

    syncRecords: function(sourceRecords){
        var syncer = Ext.create('CArABU.technicalservices.ArtifactSyncer',{
            workspaceSettings: this.getWorkspaceSettingsHash(),
            copyFields: CArABU.technicalservices.WorkspaceSettingsUtility.copyFields.concat[CArABU.technicalservices.WorkspaceSettingsUtility.syncFetchFields],
            context: this.getContext(),
            listeners: {
                syncerror: function(error){
                    this.logger.log('syncerror',error);
                    Rally.ui.notify.Notifier.showError({message: error});
                },
                synccomplete: function(syncedRecords, unsyncedRecords, syncErrors){
                    syncedRecords = syncedRecords || [];
                    unsyncedRecords = unsyncedRecords || [];
                    this.logger.log('synccomplete',syncedRecords, unsyncedRecords, syncErrors);

                    if (unsyncedRecords && unsyncedRecords.length > 0){
                        var msg = Ext.String.format("{0} of {1} records updated successfully.<br/><br/>Failures:<br/>",syncedRecords.length, syncedRecords.length + unsyncedRecords.length);
                        for (var i =0; i< unsyncedRecords.length; i++){
                            msg += Ext.String.format("[{0}] {1}<br/>", unsyncedRecords[i].get('_refObjectName'),syncErrors[i])
                        }
                        Rally.ui.notify.Notifier.showWarning({message: msg, allowHTML: true});
                    } else {
                        Rally.ui.notify.Notifier.show({message: Ext.String.format("{0} records updated.", syncedRecords.length)});
                    }
                },
                syncstatus: function(status){
                    this.logger.log('syncstatus',status);
                    Rally.ui.notify.Notifier.show({message: status});
                },
                scope: this
            }
        });
        syncer.sync(sourceRecords);
    },
    getSettingsFields: function(){
        return CrossWorkspaceCopier.Settings.getFields(this.workspaceSettings);
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        this._initializeWorkspaceSettingsHash(settings);
    },

    /**
     * Update the settings for this app in preferences.
     * Provide a settings hash and this will update existing prefs or create new prefs.
     * @param options.settings the settings to create/update
     * @param options.success called when the prefs are loaded
     * @param options.scope scope to call success with
     */
    updateSettingsValues: function(options) {

        Rally.data.PreferenceManager.update(Ext.apply(this._getAppSettingsLoadOptions(), {
            requester: this,
            settings: options.settings,
            success: function(updatedSettings) {
                Ext.apply(this.settings, updatedSettings);

                if (options.success) {
                    options.success.call(options.scope);
                }
            },
            scope: this
        }));
    },
});
