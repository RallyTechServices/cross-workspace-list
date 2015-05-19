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
        this._addSelectors(this.down('#selector_box'));

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
    },
    _gatherData: function(settings) {
        var me = this;
        this.down('#display_box').removeAll();
        
        this.logger.log("Settings are:", settings);
        
        var model_name = 'UserStory';
        var field_names = ['FormattedID','Name','ScheduleState', settings.link_field];
        var filters = [{property:settings.link_field, operator:'contains', value:'a href'}];

        this.setLoading("Loading stories...");
        
        this._loadAStoreWithAPromise(model_name, field_names, filters).then({
            scope: this,
            success: function(store) {
                this._displayGrid(store,field_names);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
    },
    _loadAStoreWithAPromise: function(model_name, model_fields,filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: filters
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(this);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem finding User Stories: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    _displayGrid: function(store,field_names){
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: field_names
        });
    },
    _launchCopyDialog: function() {
        Ext.create('Rally.technicalservices.dialog.CopyDialog', {
            artifactTypes: ['userstory'],
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
        this.down('#create_button').setDisabled(false);
        
        this._gatherData(settings);
    }
});
