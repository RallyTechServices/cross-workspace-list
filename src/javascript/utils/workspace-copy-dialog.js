Ext.define('CA.technicalservices.xWorkspaceCopyDialog',{
    extend: 'Rally.ui.dialog.Dialog',

    height: 400,
    width: 600,
    layout: 'fit',
    closable: true,
    draggable: true,


    constructor: function(config) {
        this.mergeConfig(config);

        this.callParent([this.config]);
    },
    initComponent: function() {
        this.callParent(arguments);

        this.addEvents(
            /**
             * @event optionschosen
             * Fires when user clicks done after choosing a project and other options
             * @param {Rally.ui.dialog.ArtifactChooserDialog} source the dialog
             * @param {Rally.data.wsapi.Model}| {Rally.data.wsapi.Model[]} selection selected record or an array of selected records if multiple is true
             */
            'optionschosen'
        );

    },
    getOptions: function(){
        return {};
    },
    beforeRender: function() {
        this.callParent(arguments);

        this.selectedProject = null;

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
                    cls: 'primary rly-small',
                    disabled: true,
                    handler: function() {
                        this.fireEvent('optionschosen', this.getOptions());
                        this.close();
                    },
                    itemId: 'doneButton',
                    scope: this,
                    text: "Done",
                    userAction: 'clicked done item in dialog'
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
                componentCls: 'intro-panel',
                html: this.introText,
                dock: 'top'
            });
        }

        //TODO only show workspaces that can copy all the record types selected.
        var workspaces = CArABU.technicalservices.WorkspaceSettingsUtility.getDestinationWorkspaceConfigurations();

        var filters = _.map(workspaces, function(w){ return { property: "ObjectID", value: w.ObjectID}; });
        filters = Rally.data.wsapi.Filter.or(filters);
        filters = filters.and({
            property: 'State',
            value: 'Open'
        });
        filters = filters.and({
            property: 'Projects.State',
            value: 'Open'
        });

        var pt = this.add({
            xtype: 'rallyprojecttree',
            itemId: 'prjTree',
            border: false,
            autoScroll: true,
            topLevelStoreConfig: {
                fetch: ['Name', 'State'],
                filters: filters,
                sorters: [{
                    property: 'Name',
                    direction: 'ASC'
                }],
                context: {
                    workspace: 'null',
                    project: undefined
                }
            }
        });
        pt.on('itemselected', this.projectSelected, this);

        this.add({
            xtype: 'rallycheckboxfield',
            itemId: 'optionsCopyHierarchy',
            fieldLabel: 'Copy Entire Hierarchy'
        });

    },
    projectSelected: function(treeItem){
        this.selectedProject = treeItem && treeItem.getRecord() || null;
        this.down('#doneButton').setDisabled(this.selectedProject === null);
    },
    getOptions: function(){
        var copyHierarchy = this.down('#optionsCopyHierarchy') && this.down('#optionsCopyHierarchy').getValue() || false;
        return {
            project: this.selectedProject,
            copyHierarchy: copyHierarchy || false,
            records: this.records
        };
    }


});