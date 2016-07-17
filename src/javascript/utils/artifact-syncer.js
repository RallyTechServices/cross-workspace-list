Ext.define('CArABU.technicalservices.ArtifactSyncer',{
    logger: new Rally.technicalservices.Logger(),
    mixins: {
        observable: 'Ext.util.Observable'
    },

    constructor: function(config){
        this.workspaceSettings = config.workspaceSettings;
        this.fetchFields = config.copyFields;
        this.context = config.context;

        this.mixins.observable.constructor.call(this, config);

        this.addEvents(
            'syncerror',
            'syncstatus',
            'synccomplete'
        );
    },
    sync: function(sourceRecords){
        var linkField = CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspaceLinkField();
        this.syncedRecords = [];
        this.unsyncedRecords = [];
        this.syncErrors = [];

        var promises = [], me=this;
        Ext.Array.each(sourceRecords, function(r){
            promises.push(function(){ var rec = r; return me.syncLinkedArtifact(rec, linkField);});
        }, this);
        Deft.Chain.sequence(promises).then({
            success: function(){
                this.fireEvent('synccomplete', this.syncedRecords, this.unsyncedRecords, this.syncErrors);
            },
            scope: this
        });

    },
    syncLinkedArtifact: function(sourceRecord, linkField){
        var deferred = Ext.create('Deft.Deferred');
        var link = sourceRecord.get(linkField),
            matches = /<a.*href=".*\/#\/(\d+).*\/detail\/.*\/(\d+)">(.*)<\/a>/.exec(link),
            objectID = CArABU.technicalservices.WorkspaceSettingsUtility.getObjectIDFromLinkValue(link),
            store_context = CArABU.technicalservices.WorkspaceSettingsUtility.getContextFromLinkValue(link);

        if (!objectID || !store_context){
            this.logger.log('No context or matches for artifact found:  ' + sourceRecord.get('FormattedID') ,link, matches);
            this.unsyncedRecords.push(sourceRecord);
            this.syncErrors.push('No context (workspace or project) or matches.  Please verify that the destination workpsce and project are configured via the App settings and the object exists.');
            deferred.resolve();
            return deferred;
        }

        var modelName = CArABU.technicalservices.WorkspaceSettingsUtility.getDestinationModelType(sourceRecord.get('_type'), store_context);
        this.logger.log('syncLinkedArtifact', objectID, store_context, modelName);

        Rally.data.ModelFactory.getModel({
            type: modelName,
            context: store_context,
            success: function(model){
                model.load(objectID, {
                    fetch: this.fetchFields,
                    callback: function(destinationRecord, operation) {
                        if(operation.wasSuccessful()) {
                            this.logger.log('Success', destinationRecord.get('LastUpdateDate'), sourceRecord.get('LastUpdateDate'));
                            this._syncRecord(sourceRecord, destinationRecord).then({
                                success: function(){
                                    deferred.resolve();
                                }
                            });
                        } else {
                            this.unsyncedRecords.push(sourceRecord);
                            var msg = "FAILURE to load linked record [" + objectID + "]: " + operation.error.errors.join(',');
                            this.logger.log('FAILURE', msg, operation);
                            this.syncErrors.push(msg);
                            deferred.resolve();
                        }
                    },
                    scope: this
                });
            },
            failure: function(){
                this.unsyncedRecords.push(sourceRecord);
                var msg = 'FAILURE to load Model ' + modelName;
                this.logger.log('FAILURE', msg);
                this.fireEvent('syncerror', msg);
                this.syncErrors.push(msg);
                deferred.resolve();
            },
            scope: this
        });
        return deferred;
    },
    _syncRecord: function(sourceRecord, destinationRecord){
        var deferred = Ext.create('Deft.Deferred');
        var type = sourceRecord.get('_type');
        this.logger.log('_syncRecord', sourceRecord, destinationRecord.get('LastUpdateDate'), sourceRecord.get('LastUpdateDate'), type);

        var syncSource = sourceRecord,
            syncTarget = destinationRecord;

        if (sourceRecord.get('LastUpdateDate') < destinationRecord.get('LastUpdateDate')){
            syncSource = destinationRecord;
            syncTarget= sourceRecord;
        }

        Ext.Array.each(CArABU.technicalservices.WorkspaceSettingsUtility.getSyncFields(type), function(f){
            var val = CArABU.technicalservices.WorkspaceSettingsUtility.getMappedValue(syncSource, f, syncTarget.get('Workspace')._ref);
            if (Ext.isObject(val)){
                val = val._ref;
            }

            syncTarget.set(f,val);
        }, this);

        if (syncTarget.dirty){
            syncTarget.save({
                callback: function(record, operation){
                    if (operation.wasSuccessful()){
                        this.logger.log('syncTarget saved', record);
                        this.syncedRecords.push(sourceRecord);
                        deferred.resolve();
                    } else {
                        var msg = Ext.String.format("Failed to sync record {0}: {1}",sourceRecord.get('FormattedID'), operation.error.errors.join(','));
                        this.logger.log('syncTarget failed', msg);
                        this.unsyncedRecords.push(sourceRecord);
                        this.syncErrors.push(msg);
                        deferred.resolve();
                    }
                },
                scope:this
            });
        } else {
            this.logger.log('syncTarget up to date', syncTarget);
            deferred.resolve();
        }

        return deferred;
    }

});