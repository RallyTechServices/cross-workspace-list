Ext.define('CrossWorkspaceCopier.Settings',{
    singleton: true,



    getFields: function(workspaceSettings){
        console.log('workspaceSettings', workspaceSettings)

        return [{
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


                    if ( attribute.AttributeType == "STRING" && attribute.Custom == true) {
                        //console.log(field.name,attribute.AttributeType,field);
                        return true;
                    }
                }
                return false;
            }
        },{
            xtype: 'workspacesettingsform',
            name: 'workspaceSettings',
            workspaceSettings: workspaceSettings,
            fieldLabel: 'Configure workspaces available for copy and mappings',
            labelAlign: 'top',
            margin: '25 0 300 0',

          //  readyEvent: 'ready'
        }];
    }
});
