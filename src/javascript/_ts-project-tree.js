Ext.define('Rally.ui.tree.ProjectTree', {
    extend: 'Rally.ui.tree.Tree',
    alias: 'widget.rallyprojecttree',

    requires: [
        'Rally.ui.tree.PlainTreeItem'
    ],

    config: {
        topLevelModel: Ext.identityFn('Workspace'),

        topLevelStoreConfig: {
            fetch: ['Name', 'State', 'Workspace'],
            filters: [{
                property: 'State',
                value: 'Open'
            }, {
                property: 'Projects.State',
                value: 'Open'
            }],
            sorters: [{
                property: 'Name',
                direction: 'ASC'
            }],
            context: {
                workspace: 'null',
                project: undefined
            }
        },

        /**
         * @cfg {String}
         * If workspace _ref is supplied, we overwrite topLevelModel and topLevelStoreConfig
         * so that we only show projects under that workspace. We also do not show the top level workspace.
         */
        workspace: undefined,

        treeItemConfigForRecordFn: function(record){
            if(record.get('_type') === 'workspace'){
                return {
                    xtype: 'rallyplaintreeitem'
                };
            } else {
                return {
                    xtype: 'rallyplaintreeitem',
                    selectable: true
                };
            }
        },

        childModelTypeForRecordFn: function(){
            return 'Project';
        },

        givenAParentRecordWhatIsTheAttributeConnectingAChildToThisParentFn: function(record){
            return 'Parent';
        },

        childItemsStoreConfigForParentRecordFn: function(record){

            var storeConfig = {
                fetch: ['Name', 'Children:summary[State]', 'State', 'Workspace'],
                sorters: [{
                    property: 'Name',
                    direction: 'ASC'
                }]
            };

            if(record.get('_type') === 'workspace'){
                return Ext.apply(storeConfig, {
                    filters: [{
                        property: 'Parent',
                        value: 'null'
                    }],
                    context: {
                        workspace: record.get('_ref'),
                        project: null
                    }
                });
            } else {
                return Ext.apply(storeConfig, {
                    filters: [{
                        property: 'Parent',
                        value: record.get('_ref')
                    }],
                    context: {
                        workspace: record.get('Workspace')._ref,
                        project: null
                    }
                });
            }
        },

        canExpandFn: function(record){
            if(record.get('_type') === 'workspace'){
                //query filters out Workspaces with closed projects, so any workspace can be expanded
                return true;
            }
            return record.get('Summary').Children.State.Open;
        }
    },

    constructor: function(config) {
        if (config.workspace) {
            config.topLevelModel = 'Project';
            config.topLevelStoreConfig = {
                fetch: ['Name', 'State', 'Children:summary[State]'],
                filters: [{
                    property: 'State',
                    value: 'Open'
                }, {
                    property: 'Parent',
                    value: 'null'
                }],
                sorters: [{
                    property: 'Name',
                    direction: 'ASC'
                }],
                context: {
                    workspace: config.workspace,
                    project: undefined
                }
            };
        }

        this.callParent(arguments);
    }
});

