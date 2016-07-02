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
            //            {
            //    'hierarchicalrequirement': ['Name','ScheduleState','Description','PlanEstimate'],
            //    'task': ['Name','State','Description'],
            //    'portfolioitem': ['Name','State','PlannedStartDate','PlannedEndDate']
            //},
            syncFields: {},
            workspaceSettings: {}
        }
    },

    sourcePortfolioItemTypes: [],
    workspaceSettings: null,

    launch: function() {

        this._validateAppSettings()
    },
    _validateAppSettings: function(){
        this.down('#display_box').removeAll();

        this.logger.log('_validateApp', this.getSetting('workspaceSettings'), this.getSetting('link_field'));
        if (Ext.isEmpty(this.getSetting('workspaceSettings')) || this.getSetting('link_field') == "") {
            this.down('#display_box').add({
                xtype: 'container',
                html: 'Use the "App Settings..." menu choice to configure this app'
            });
            return;
        }
        this._initializeWorkspaceSettings();
    },
    /**
     * Initializes the current workspace settings, loading in the link field, as well as the states and
     * portfolio item types.
     * @returns {Deft.Deferred}
     * @private
     */
    _initializeWorkspaceSettings: function(){
        this.workspaceSettings = Ext.create('CArABU.technicalservices.WorkspaceSettings',{
            context: this.getContext()
        });
        this.workspaceSettings.on('ready', this._addSelectors, this);
        this.workspaceSettings.initialize(this.getSetting('workspaceSetting') || {}, this.getSetting('link_field') || "");
    },
    _addSelectors: function() {
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

        var btn = container.add({
            xtype: 'rallybutton',
            enableToggle: true,
            itemId: 'btToggleState',
            margin: 5,
            iconCls: 'icon-link'
        });


        var syncBtn = container.add({
            xtype: 'rallybutton',
            itemId: 'btSync',
            iconCls: 'icon-refresh',
            margin: 5
        });

        btn.on('toggle', this._toggleView, this);
        syncBtn.on('click', this._sync, this);

    },
    _toggleView: function(btn){
        var allowSync = !btn.pressed,
            syncBtn = this.getSyncButton();

        this.logger.log('_toggleView', allowSync, syncBtn);

        if (btn.pressed){
            btn.removeCls('primary')
            btn.addCls('secondary')
        } else {
            btn.removeCls('secondary')
            btn.addCls('primary')
        }
        if (syncBtn) { syncBtn.setDisabled(allowSync); }

        this._updateView();
    },
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
            linkField = this.getWorkspaces().getLinkField();

        this.down('rallygridboard').getGridOrBoard().getStore().each(function(r){
            if (r.get(linkField)){
                sourceRecords.push(r);
            }
        });

        this.logger.log('_sync', sourceRecords);

        var loader = Ext.create('CArABU.technicalservices.ArtifactLoader',{
            portfolioItemTypes: this.workspaceSettings.getCurrentWorkspace().portfolioItemTypes,
            loadLinkedItems: true,
            workspaceSettings: this.getWorkspaces(),
            copyFields: this.getFieldsToCopy().concat(['LastUpdateDate',linkField]),
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



        //var updater = Ext.create('Rally.technicalservices.artifactCopier',{
        //    fieldsToCopy: this.fieldsToUpdate,
        //    linkField: this.getLinkField(),
        //    context: this.getContext(),
        //    listeners: {
        //        scope: this,
        //        artifactupdated: function(originalArtifact){
        //            this.logger.log('artifactupdated', originalArtifact);
        //            Rally.ui.notify.Notifier.showUpdate({artifact: originalArtifact});
        //            this.down('#link-grid').getStore().reload();
        //        },
        //        updateerror: function(msg){
        //
        //        },
        //        updatewarning: function(msg){
        //            this.logger.log('updatewarning',msg);
        //            Rally.ui.notify.Notifier.showWarning({message: msg});
        //        }
        //    }
        //});
        //_.each(records_to_update, function(r){
        //    updater.updateFromLinkedArtifact(r);
        //});
    },

    getLinkField: function(){
        return this.getWorkspaces().getCurrentWorkspace().linkField;
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
    getTypesToCopy: function(type){
        return this.getWorkspaces().getCopyableTypes(type);
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
        store.load();
        box.add({
            xtype: 'rallygridboard',
            context: this.getContext(),
            modelNames: [type],
            toggleState: 'grid',
            gridConfig: {
                store: store,
                storeConfig: {
                   // filters: this.getFilters(),
                    pageSize: 200
                },
                noDataPrimaryText: this.getNoDataPrimaryText(),
                noDataSecondaryText: this.getNoDataSecondaryText(),
                columnCfgs: this.getColumnCfgs(type),
                bulkEditConfig: {
                    items: [{
                        xtype: 'bulkmenuitemxworkspacecopy' ,
                        linkField: this.getLinkField(),
                        typesToCopy: this.getTypesToCopy(type),
                        copyFields: this.getFieldsToCopy(),
                        workspaceSettings: this.getWorkspaces(),
                        context: this.getContext()
                    },{
                        xtype: 'bulkmenuitemxworkspacedeepcopy' ,
                        linkField: this.getLinkField(),
                        typesToCopy: this.getTypesToCopy(type),
                        copyFields: this.getFieldsToCopy(),
                        workspaceSettings: this.getWorkspaces(),
                        context: this.getContext()
                    }]
                }
            },
            //plugins: this._getPlugins(),
            height: this.getHeight()
        });
    },

    syncRecords: function(sourceRecords){
        var syncer = Ext.create('CArABU.technicalservices.ArtifactSyncer',{
            workspaceSettings: this.getWorkspaces(),
            copyFields: this.getFieldsToCopy().concat['LastUpdateDate'],
            context: this.getContext(),
            listeners: {
                syncerror: function(error){
                    this.logger.log('syncerror',error);
                    Rally.ui.notify.Notifier.showError({message: error});
                },
                synccomplete: function(records){
                    this.logger.log('synccomplete',records);
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
    //_gatherData: function(settings) {
    //    this.down('#display_box').removeAll();
    //
    //    this.logger.log("Settings are:", settings);
    //    var linkField = this.getLinkField();
    //
    //    var model_name = 'UserStory';
    //    var field_names = _.uniq(['FormattedID'].concat(this.fieldsToCopy).concat([linkField]).concat(this.fieldsToUpdate));
    //    this.logger.log('_gatherData',field_names, linkField);
    //
    //    var filters = [{property:linkField, operator:'contains', value: 'href' }];
    //
    //    Ext.create('Rally.data.wsapi.Store',{
    //        model: model_name,
    //        fetch: field_names,
    //        filters: filters,
    //        autoLoad: true,
    //        listeners: {
    //            scope: this,
    //            load: function(store, records, success){
    //                this.logger.log('store',store, records);
    //                var fields = this.getGridFields().concat(linkField);
    //                this._displayGrid(store,fields,linkField);
    //            }
    //        }
    //    });
    //},
    //
    //_displayGrid: function(store,field_names, link_field){
    //
    //    if (this.down('#link-grid')){
    //        this.down('#link-grid').destroy();
    //    }
    //
    //    var field_names = ['FormattedID','Name','ScheduleState'].concat(link_field);
    //
    //    var columnCfgs = [];
    //
    //    _.each(field_names, function(f){
    //        if (f == link_field){
    //            columnCfgs.push({
    //                dataIndex: f,
    //                text: f
    //            });
    //        } else {
    //            columnCfgs.push({dataIndex: f, text: f});
    //        }
    //    }, this);
    //
    //    this.down('#display_box').add({
    //        xtype: 'rallygrid',
    //        itemId: 'link-grid',
    //        store: store,
    //        columnCfgs: columnCfgs,
    //        showRowActionsColumn: false
    //    });
    //},
//    _launchCopyDialog: function() {
//
//        var filters = [{property:this.link_field, value: null }];
//        var fetch = [this.link_field].concat(this.fieldsToCopy);
//        this.logger.log('_launchCopyDialog',  this.fieldsToCopy, fetch);
//
//        Ext.create('Rally.technicalservices.dialog.CopyDialog', {
//            artifactTypes: ['userstory'],
//            storeConfig: {
//                fetch: fetch,
//                filters: filters,
//                context: {
//                    workspace: this.getContext().getWorkspace()._ref,
//                    project: this.getContext().getProject()._ref,
//                    projectScopeDown: this.getContext().getProjectScopeDown()
//                }
//            },
//            autoShow: true,
//            height: 400,
//            title: 'Copy',
//            introText: 'Choose a target workspace/project and search for a story to copy',
//            multiple: false,
//            listeners: {
//                artifactchosen: function(dialog, selection){
//                    // {selectedRecords: x, targetProject: y, targetWorkspace: z }
//                    // selectedRecords is a model.  (In an array if multiple was true)
//                    // targetproject, targetworkspace are hashes (do not respond to .get('x'), but to .x
//                    this.logger.log('selected:',selection);
//
//                    var copier = Ext.create('Rally.technicalservices.artifactCopier',{
//                        fieldsToCopy: this.fieldsToCopy,
//                        linkField: this.getSetting('link_field'),
//                        context: this.getContext(),
//                        listeners: {
//                            scope: this,
//                            artifactcreated: function(newArtifact){
//                                console.log('artifactcreated',newArtifact);
////                                this.down('#link-grid').getStore().reload();
//                                Rally.ui.notify.Notifier.showCreate({artifact: newArtifact});
//                            },
//                            copyerror: function(error_msg){
//                                Rally.ui.notify.Notifier.showError({message: error_msg});
//                            },
//                            artifactupdated: function(originalArtifact){
//                                this.logger.log('artifactupdated', originalArtifact);
//                                Rally.ui.notify.Notifier.showUpdate({artifact: originalArtifact});
//                                this.down('#link-grid').getStore().reload();
//                            },
//                            updateerror: function(msg){
//                                this.logger.log('updateerror',msg);
//                                Rally.ui.notify.Notifier.showError({message: msg});
//                            }
//                        }
//                    });
//                    copier.copy(selection.targetWorkspace, selection.targetProject, selection.selectedRecords);
//                },
//                scope: this
//            }
//        });
//    },
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
        this.logger.log('onSettingsUpdate',settings, this.workspaceSettings);
        // Ext.apply(this, settings);
        this._validateApp();
    }
});
