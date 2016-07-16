Ext.define('CA.technicalservices.BulkMenuItem.xWorkspaceDeepCopy', {
    alias: 'widget.bulkmenuitemxworkspacedeepcopy',
    extend: 'CA.technicalservices.BulkMenuItem.xWorkspaceCopyBase',

    config: {

        text: 'Deep Copy to Workspace...',

        predicate: function (records) {
            //TODO: Make sure that all children are valid to copy
            var linkField = CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspaceLinkField(),
                copiedTypes = _.map(this.typesToCopy, function(t){ return t.toLowerCase(); });

            return _.every(records, function (record) {
                var type = record.get('_type').toLowerCase();

                if (Ext.Array.contains(copiedTypes, type)){
                    return !record.get(linkField);
                }
                return false;
            });
        }
    },

    _loadRecordsToCopy: function(options){
        var deferred = Ext.create('Deft.Deferred'),
            loader = Ext.create('CArABU.technicalservices.ArtifactLoader',{
                portfolioItemTypes: CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspacePortfolioItemTypes(),
                copyFields: this.copyFields,
                listeners: {
                    loaderror: function(error){
                        deferred.reject(error);
                    },
                    loadcomplete: function(records){
                        deferred.resolve(records);
                    }
                }
            });

        loader.loadHierarchy(this.records);
        return deferred;
    }

});