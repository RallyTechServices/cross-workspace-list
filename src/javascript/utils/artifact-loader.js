Ext.define('CArABU.technicalservices.ArtifactLoader',{
    logger: new Rally.technicalservices.Logger(),
    mixins: {
        observable: 'Ext.util.Observable'
    },

    constructor: function (config) {
        // The Observable constructor copies all of the properties of `config` on
        // to `this` using Ext.apply. Further, the `listeners` property is
        // processed to add listeners.
        //
        this.loadLinkedItems = config.loadLinkedItems || false;
        this.fetchFields = config.copyFields;

        this.logger.log('ArtifactLoader Constructor', config, this.fetchFields);
        this.mixins.observable.constructor.call(this, config);

        this.addEvents(
            'loaderror',
            'loadcomplete'
        );
    },
    loadHierarchy: function(records){
        var oids = _.map(records, function(r){ return r.get('ObjectID'); }),
            types = CArABU.technicalservices.WorkspaceSettingsUtility.getArtifactModelNames(),
            find = {
                "__At": "current",
                "_ItemHierarchy": {$in: oids},
                "_TypeHierarchy": {$in: types}
                //TODO, do we want to restrict projects?
            };

        if (this.loadLinkedItems){
            var linkedField =  CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspaceLinkField(this.workspaceSettings, this.context);
            find[linkedField] = {$ne: null}
        }

        this.logger.log('loadHierarchy', records, oids, types);
        var lbStore = Ext.create('Rally.data.lookback.SnapshotStore',{
            fetch: ['ObjectID'],
            find: find,
            limit: 'Infinity',
            removeUnauthorizedSnapshots: true
        });

        lbStore.load({
            callback: function(hierarchyRecords, operation, success){
                this.logger.log('loadHierarchy',success, hierarchyRecords, operation);
                if (success){
                    var hierarchyOids = _.map(hierarchyRecords, function(r){ return r.get('ObjectID'); });
                    if (!hierarchyOids || hierarchyOids.length === 0){
                        this.fireEvent('loaderror', "No records found.");
                    }
                    this._fetchArtifacts(hierarchyOids).then({
                        success: function(artifacts){
                            this.fireEvent('loadcomplete', artifacts);
                        },
                        failure: function(operation){
                            var errMsg = "Error loading records for hierarchy: " + operation.error.errors.join(',');
                            this.fireEvent('loaderror', errMsg);
                        },
                        scope: this
                    });
                } else {
                    var errMsg = "Error loading hierarchy: " + operation && operation.error && operation.error.errors && operation.error.errors.join(',') || "Request may have timed out.  Please refresh and try again.";
                    this.fireEvent('loaderror', errMsg);
                }
            },
            scope: this
        });
    },
    load: function(records){
        this.fireEvent('loadcomplete', records);
    },
    _fetchArtifacts: function(objectIDs){
        var deferred = Ext.create('Deft.Deferred'),
            chunks = this._getChunks(objectIDs),
            promises = [];

        Ext.Array.each(chunks, function(chunkArray){
            promises.push(this._fetchArtifactsChunk(chunkArray));
        }, this);

        Deft.Promise.all(promises).then({
            success: function(results){
               deferred.resolve(_.flatten(results));
            },
            failure: function(operation){
                deferred.reject(operation);
            }
        });
        return deferred.promise;

    },
    _getChunks: function(objectIDs){
        var chunks = [],
            maxListSize = 25,
            idx = 0;

        chunks[idx] = [];
        _.each(objectIDs, function(oid){
            if (chunks[idx].length >= maxListSize){
                idx++;
                chunks[idx] = [];
            }
            chunks[idx].push(oid);
        });

        return chunks;
    },
    _fetchArtifactsChunk: function(objectIDs, options){
        var deferred = Ext.create('Deft.Deferred'),
            filters = _.map(objectIDs, function(o){
            return {
                property: 'ObjectID',
                value: o
            }
        });
        filters = Rally.data.wsapi.Filter.or(filters);

        this.logger.log('_fetchArtifactsChunk', objectIDs, filters && filters.toString(),this._getArtifactFetchList(),
            CArABU.technicalservices.WorkspaceSettingsUtility.getArtifactModelNames());

        Ext.create('Rally.data.wsapi.artifact.Store',{
            models: CArABU.technicalservices.WorkspaceSettingsUtility.getArtifactModelNames(),
            fetch: this._getArtifactFetchList(),
            filters: filters
        }).load({
            callback: function(records, operation){
                if (operation.wasSuccessful()){
                    deferred.resolve(records);
                } else {
                    deferred.reject(operation);
                }
            }
        });
        return deferred;
    },


    _getArtifactFetchList: function(){
        return this.fetchFields.concat(['Parent','FormattedID','WorkProduct','PortfolioItem','ObjectID','Workspace','LastUpdateDate']);
    }
});
