Ext.define('CArABU.technicalservices.WorkspaceSettingsForm',{
    extend: 'Ext.form.field.Base',
    alias: 'widget.workspacesettingsform',
    fieldSubTpl: '<div id="{id}" class="settings-grid"></div>',
    width: '100%',
    cls: 'column-settings',

    store: undefined,
    mixins: {
        observable: 'Ext.util.Observable'
    },
    constructor: function(config){
        this.mixins.observable.constructor.call(this, config);
        this.callParent(arguments);
    },
    onDestroy: function() {
        if (this._grid) {
            this._grid.destroy();
            delete this._grid;
        }
        this.callParent(arguments);
    },
    initComponent: function(){
        this.callParent();
        this.addEvents('ready');

        if (this.rendered){
            this._buildWorkspaceGrid()
        } else {
            this.on('render', this._buildWorkspaceGrid, this);
        }
    },
    _buildWorkspaceGrid: function(records, operation, success){

        var data = [],
            empty_text = "No destination workspaces configured.";


        var decodedValue = {};
        console.log('this.value', this.value);
        if (this.value && !_.isEmpty(this.value)){
            decodedValue = Ext.JSON.decode(this.value);
        }
        Ext.Object.each(decodedValue, function(key, wk){
            data.push(wk);
        });

        var custom_store = Ext.create('Ext.data.Store', {
            fields: CArABU.technicalservices.WorkspaceSettingsUtility.getSettingsDataFields(),
            data: data
        });

        this._grid = Ext.create('Rally.ui.grid.Grid', {
            autoWidth: true,
            renderTo: this.inputEl,
            columnCfgs: this._getColumnCfgs(),
            showRowActionsColumn: false,
            showPagingToolbar: false,
            store: custom_store,
            maxHeight: 300,
            margin: '20 0 0 0',
            emptyText: empty_text,
            editingConfig: {
                publishMessages: false
            }
        });

        Ext.create('Rally.ui.Button',{
            text: 'Add Workspace...',
            renderTo: this.inputEl,
            margin: '10 0 0 0',
            listeners: {
                scope: this,
                click: this._addWorkspace
            }
        });


        var width = Math.max(this.inputEl.getWidth(true),300);

        this.fireEvent('ready', true);

    },
    _addWorkspace: function(){

        if (this.workspaces){
            this._showWorkspaceDialog(this.workspaces);
        } else {
            CArABU.technicalservices.WsapiToolbox.fetchWorkspaces().then({
                success: this._showWorkspaceDialog,
                failure: this._showError,
                scope: this
            });
        }
    },
    _showWorkspaceDialog: function(workspaces, selectedWorkspaceStore){
        this.workspaces = workspaces;
        var width = this.getWidth();

        var cfg = Ext.create('CArABU.technicalservices.WorkspaceConfigurationDialog', {
            autoShow: true,
            maxHeight: 400,
            maxWidth: 400,
            workspaces: workspaces,
            selectedWorkspaceStore: selectedWorkspaceStore,
            workspaceSettings: this.workspaceSettings,
            width: Math.min(width, 400),
            title: 'Add Workspace'
        });
        cfg.on('saveconfiguration', this._saveConfiguration, this);
    },
    _saveConfiguration: function(workspaceStore){
        var found = false;
        Ext.Array.each(this._grid.getStore().getRange(), function(r){
            if (r.get('Name') === workspaceStore.Name){
                found = true;
                r.set('linkField', workspaceStore.linkField);
                r.set('mappings', workspaceStore.mappings);
                r.set('portfolioItemTypes', workspaceStore.portfolioItemTypes);
                r.set('portfolioItemStates', workspaceStore.portfolioItemStates);
                r.set('models', workspaceStore.models);
                r.save();
                return false;
            }
        });
        if (!found){
            this._grid.getStore().add(workspaceStore);
        }

    },
    _showError: function(msg){
        //TODO add error text
    },

    _getColumnCfgs: function() {
        var me = this;

        var columns = [{
            xtype: 'rallyrowactioncolumn',
            rowActionsFn: function (record) {
                return [
                    {
                        xtype: 'rallyrecordmenuitem',
                        record: record,
                        text: "Edit...",
                        handler: function(){
                            var objId = record.get('ObjectID');
                            me._showWorkspaceDialog(me.workspaces, record.getData());
                         },
                         scope: me
                    },{
                        xtype: 'rallyrecordmenuitem',
                        record: record,
                        text: 'Delete',
                        handler: function(){
                            this._grid.getStore().remove(record);
                            record.destroy();
                        },
                        scope: me
                    }
                ];
            }
        },{
            text: 'Workspace',
            dataIndex: 'Name',
            flex: 1,
            editor: false
        },{
            text: 'Link Field',
            dataIndex: 'linkField'
        }];
        return columns;
    },
    _buildValue: function(){
        var data = {};
        //todo build from store
        Ext.Array.each(this._grid.getStore().getRange(), function(r){

            data[r.get('ObjectID')] = {
                _ref: r.get('_ref'),
                Name: r.get('Name'),
                ObjectID: r.get('ObjectID'),
                linkField: r.get('linkField'),
                portfolioItemTypes: r.get('portfolioItemTypes'),
                mappings: r.get('mappings'),
                portfolioItemStates: r.get('portfolioItemStates')
            };

        });
        return data;
    },
    /**
     * When a form asks for the data this field represents,
     * give it the name of this field and the ref of the selected project (or an empty string).
     * Used when persisting the value of this field.
     * @return {Object}
     */
    getSubmitData: function() {
        var data = {}, val = this._buildValue();
        data[this.name] = Ext.JSON.encode(val);
        return data;  
    },
    getErrors: function() {
        var errors = [];
        //Add validation here
        return errors;
    },
    setValue: function(value) {
        this.callParent(arguments);
        this._value = value;
    }
});
