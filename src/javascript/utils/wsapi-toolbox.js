Ext.define('CArABU.technicalservices.WsapiToolbox',{
    singleton: true,
    fetchWorkspaces: function(){
        var deferred = Ext.create('Deft.Deferred');
        Ext.create('Rally.data.wsapi.Store', {
            model: 'Subscription',
            fetch: ['Workspaces','Name','ObjectID']
        }).load({
            callback: function(records, operation, success){
                if (success){
                    records[0].getCollection('Workspaces',{
                        fetch: ['ObjectID','Name','State'],
                        limit: 'Infinity',
                        buffered: false
                    }).load({
                        callback: function(workspaces, operation){
                            if (operation.wasSuccessful()){
                                deferred.resolve(workspaces);
                            } else {
                                deferred.reject('Error loading workspace information: ' + operation.error && operation.error.errors.join(','));
                            }
                        }
                    });
                } else {
                    deferred.reject('Error querying Subscription: ' + operation.error && operation.error.errors.join(','));
                }
            },
            scope: this
        });
        return deferred;
    },
    fetchPortfolioItemTypes: function(context){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store', {
            model: 'TypeDefinition',
            fetch: ['TypePath', 'Ordinal','Name'],
            context: context,
            filters: [
                {
                    property: 'Parent.Name',
                    operator: '=',
                    value: 'Portfolio Item'
                },
                {
                    property: 'Creatable',
                    operator: '=',
                    value: 'true'
                }
            ],
            sorters: [{
                property: 'Ordinal',
                direction: 'ASC'
            }]
        }).load({
            callback: function(records, operation, success){
                if (success){
                    deferred.resolve(records);
                } else {
                    var error_msg = '';
                    if (operation && operation.error && operation.error.errors){
                        error_msg = operation.error.errors.join(',');
                    }
                    deferred.reject('Error loading Portfolio Item Types:  ' + error_msg);
                }
            }
        });
        return deferred.promise;
    },
    fetchAllowedValues: function(model, field){
        var deferred = Ext.create('Deft.Deferred');
        model.getField(field).getAllowedValueStore().load({
            callback: function(records, operation, success) {
                if (success){
                    deferred.resolve(records);
                } else {
                    deferred.reject('Error fetching AllowedValues:  ' + operation.error.errors.join(','));
                }
            }
        });
        return deferred;
    }
});