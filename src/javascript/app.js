Ext.define("TSCrossWorkspaceTracker", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    config: {
        defaultSettings: {
            fieldsToCopy: ['Name','Description','PlanEstimate','ScheduleState'],
            fieldsToUpdate: ['Name','Description','PlanEstimate','ScheduleState'],
            gridFields: ['FormattedID','Name','ScheduleState','PlanEstimate'],
            link_field: undefined
        }
    },
    launch: function() {
        if (!this.getSettings().link_field) {
            this.down('#display_box').add({
                xtype:'container',
                html: 'Use the "App Settings..." menu choice to configure this app'
            });
        } else {
            if (this.isExternal()){
                this.showSettings(this.config);
            } else {
                this.onSettingsUpdate(this.getSettings());
            }
        }
    },
    _addSelectors: function(container) {
        container.add({
            xtype:'rallybutton',
            text :'Create in Other Workspace',
            itemId:'create_button',
            disabled: true,
            listeners: {
                scope: this,
                click: this._launchCopyDialog
            }
        });

        container.add({
            xtype: 'rallybutton',
            text: 'Update',
            itemId: 'btn-update',
            listeners: {
                scope: this,
                click: this._update
            }
        });
    },
    _update: function(){

        var records_to_update= this.down('#link-grid').getStore().getRecords();  //Todo handle paging

        var updater = Ext.create('Rally.technicalservices.artifactCopier',{
            fieldsToCopy: this.fieldsToUpdate,
            linkField: this.getSetting('link_field'),
            context: this.getContext(),
            listeners: {
                scope: this,
                artifactupdated: function(originalArtifact){
                    this.logger.log('artifactupdated', originalArtifact);
                    Rally.ui.notify.Notifier.showUpdate({artifact: originalArtifact});
                    this.down('#link-grid').getStore().reload();
                },
                updateerror: function(msg){
                    this.logger.log('updateerror',msg);
                    Rally.ui.notify.Notifier.showError({message: msg});
                },
                updatewarning: function(msg){
                    this.logger.log('updatewarning',msg);
                    Rally.ui.notify.Notifier.showWarning({message: msg});
                }
            }
        });
        _.each(records_to_update, function(r){
            updater.updateFromLinkedArtifact(r);
        });
    },
    _gatherData: function(settings) {
        this.down('#display_box').removeAll();
        
        this.logger.log("Settings are:", settings);
        
        var model_name = 'UserStory';
        var field_names = _.uniq(['FormattedID'].concat(this.fieldsToCopy).concat([this.link_field]).concat(this.fieldsToUpdate));
        this.logger.log('_gatherData',field_names, settings.link_field);

        var filters = [{property:settings.link_field, operator:'contains', value: 'href' }];

        Ext.create('Rally.data.wsapi.Store',{
            model: model_name,
            fetch: field_names,
            filters: filters,
            autoLoad: true,
            listeners: {
                scope: this,
                load: function(store, records, success){
                    this.logger.log('store',store, records);
                    var fields = this.gridFields.concat(this.link_field);
                    this._displayGrid(store,fields,this.link_field);
                }
            }
        });
    },

    _displayGrid: function(store,field_names, link_field){

        if (this.down('#link-grid')){
            this.down('#link-grid').destroy();
        }

        var field_names = ['FormattedID','Name','ScheduleState'].concat(link_field);

        var columnCfgs = [];

        _.each(field_names, function(f){
            if (f == link_field){
                columnCfgs.push({
                    dataIndex: f,
                    text: f
                });
            } else {
                columnCfgs.push({dataIndex: f, text: f});
            }
        }, this);

        this.down('#display_box').add({
            xtype: 'rallygrid',
            itemId: 'link-grid',
            store: store,
            columnCfgs: columnCfgs,
            showRowActionsColumn: false
        });
    },
    _launchCopyDialog: function() {

        var filters = [{property:this.link_field, value: null }];
        var fetch = [this.link_field].concat(this.fieldsToCopy);
        this.logger.log('_launchCopyDialog',  this.fieldsToCopy, fetch);

        Ext.create('Rally.technicalservices.dialog.CopyDialog', {
            artifactTypes: ['userstory'],
            storeConfig: {
                fetch: fetch,
                filters: filters,
                context: {
                    workspace: this.getContext().getWorkspace()._ref,
                    project: this.getContext().getProject()._ref,
                    projectScopeDown: this.getContext().getProjectScopeDown()
                }
            },
            autoShow: true,
            height: 400,
            title: 'Copy',
            introText: 'Choose a target workspace/project and search for a story to copy',
            multiple: false,
            listeners: {
                artifactchosen: function(dialog, selection){
                    // {selectedRecords: x, targetProject: y, targetWorkspace: z }
                    // selectedRecords is a model.  (In an array if multiple was true)
                    // targetproject, targetworkspace are hashes (do not respond to .get('x'), but to .x
                    this.logger.log('selected:',selection);

                    var copier = Ext.create('Rally.technicalservices.artifactCopier',{
                        fieldsToCopy: this.fieldsToCopy,
                        linkField: this.getSetting('link_field'),
                        context: this.getContext(),
                        listeners: {
                            scope: this,
                            artifactcreated: function(newArtifact){
                               console.log('artifactcreated',newArtifact);
//                                this.down('#link-grid').getStore().reload();
                                Rally.ui.notify.Notifier.showCreate({artifact: newArtifact});
                            },
                            copyerror: function(error_msg){
                                Rally.ui.notify.Notifier.showError({message: error_msg});
                            },
                            artifactupdated: function(originalArtifact){
                                this.logger.log('artifactupdated', originalArtifact);
                                Rally.ui.notify.Notifier.showUpdate({artifact: originalArtifact});
                                this.down('#link-grid').getStore().reload();
                            },
                            updateerror: function(msg){
                                this.logger.log('updateerror',msg);
                                Rally.ui.notify.Notifier.showError({message: msg});
                            }
                        }
                    });
                    copier.copy(selection.targetWorkspace, selection.targetProject, selection.selectedRecords);
                },
                scope: this
            }
         });
    },

    /********************************************
     /* Overrides for App class
     /*
     /********************************************/
    //getSettingsFields:  Override for App
    getSettingsFields: function() {
        var me = this;

        return [
            {
                name: 'link_field',
                xtype: 'rallyfieldcombobox',
                fieldLabel: 'Link Field',
                model: 'UserStory',
                labelWidth: 200,
                labelAlign: 'right',
                minValue: 0,
                _isNotHidden: function(field) {
                    var attribute = field.attributeDefinition;
                    if ( field.readOnly == true ) {
                        return false;
                    }
               
                    if ( attribute ) {
                        if ( attribute.Constrained == true) {
                            return false;
                        }
                            
                        if ( attribute.AttributeType == "STRING" ) {
                            //console.log(field.name,attribute.AttributeType,field);
                            return true;
                        }
                    }
                    return false;
                }
            }
        ];
    },
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    //showSettings:  Override
    showSettings: function(options) {
        this._appSettings = Ext.create('Rally.app.AppSettings', Ext.apply({
            fields: this.getSettingsFields(),
            settings: this.getSettings(),
            defaultSettings: this.getDefaultSettings(),
            context: this.getContext(),
            settingsScope: this.settingsScope,
            autoScroll: true
        }, options));

        this._appSettings.on('cancel', this._hideSettings, this);
        this._appSettings.on('save', this._onSettingsSaved, this);
        if (this.isExternal()){
            if (this.down('#settings_box').getComponent(this._appSettings.id)==undefined){
                this.down('#settings_box').add(this._appSettings);
            }
        } else {
            this.hide();
            this.up().add(this._appSettings);
        }
        return this._appSettings;
    },
    _onSettingsSaved: function(settings){
        Ext.apply(this.settings, settings);
        this._hideSettings();
        this.onSettingsUpdate(settings);
    },
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        Ext.apply(this, settings);

        this._addSelectors(this.down('#selector_box'));

        this.down('#create_button').setDisabled(false);
        
        this._gatherData(settings);
    }
});
