Ext.define('CArABU.technicalservices.ArtifactCopier',{
    logger: new Rally.technicalservices.Logger(),
    mixins: {
        observable: 'Ext.util.Observable'
    },

    copyFields: null,


    constructor: function (config) {
        this.copyFields = config.copyFields;

        // The Observable constructor copies all of the properties of `config` on
        // to `this` using Ext.apply. Further, the `listeners` property is
        // processed to add listeners.
        //
        this.mixins.observable.constructor.call(this, config);

        this.addEvents(
            'copyerror',
            'copystatus',
            'copycomplete'
        );
    },
    copyRecords: function(records, destinationProject){
        this.logger.log('copyRecords', records, destinationProject);
        this.fireEvent('copystatus', Ext.String.format("Beginning copy of {0} artifacts.", records && records.length || 0));

        this.sourceRecords = records;
        this.destinationProject = destinationProject;
        this.copiedCount = 0;
        this.totalCount = records.length;

        Deft.Chain.sequence([
            this._fetchDestinationModels,
            this._copyStandaloneArtifacts,
            this._copyTasks,
            this._stitchArtifacts,
            this._updateSourceLinks
        ], this).then({
            success: function(){
                this.fireEvent('copycomplete');
            },
            failure: function(msg){
                this.fireEvent('copyerror',msg);
            },
            scope: this
        });
    },
    /**
     * _getModelNames:  creates a hash of the source workspace => destination workspace model names
     * and assigns them to a class level variable to be used by the _fetchDestinationModels function.
     * This uses a promise because we may need to retrieve the
     * portfolio item types for the destination
     * @param records
     * @private
     */
    _fetchDestinationModels: function(){
        var modelNames = {},
            models = {},
            deferred = Ext.create('Deft.Deferred'),
            records = this.sourceRecords,
            destinationProject = this.destinationProject,
            context = {
                workspace: destinationProject.get('Workspace')._ref,
                project: destinationProject.get('_ref')
            };

        Ext.Array.each(records, function(r){
            var type = r.get('_type').toLowerCase();
            if (!modelNames[type]){
                modelNames[type] = CArABU.technicalservices.WorkspaceSettingsUtility.getDestinationModelType(type, context);
            }
        }, this);

        this.logger.log('_fetchDestinationModels',models, records);
        var promises = _.map(modelNames, function(val, key){
                return this._fetchModel(val, context);
            }, this);

        Deft.Promise.all(promises).then({
            success: function(results){

                var idx = 0;
                //This assumes that the results are returned in the order they are passed, which should
                //be a correct assumption
                Ext.Object.each(modelNames, function(currentType, otherType){
                    models[currentType] = results[idx++];
                });
                this.modelHash = models;
                deferred.resolve();
            },
            failure: function(msg){
                deferred.reject(msg);
            },
            scope: this
        });

        return deferred;
    },
    _fetchModel: function(type, context){
        var deferred = Ext.create('Deft.Deferred');

        Rally.data.ModelFactory.getModel({
            type: type,
            context: context,
            success: function(model){
                deferred.resolve(model);
            },
            failure: function(){
                deferred.reject('Failed to getModel for ' + type);
            }
        });
        return deferred;
    },
    _copyStandaloneArtifacts: function(){
        this.logger.log('_copyStandaloneArtifacts', this.sourceRecords);

        this.recordHash = {};
        var destProjectRef = this.destinationProject.get('_ref'),
            workspaceID = Rally.util.Ref.getOidFromRef(this.destinationProject.get('Workspace')._ref);

        var promises = [],
            records = this.sourceRecords,
            deferred = Ext.create('Deft.Deferred'),
            sourceWorkspaceName = CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspaceName(),
            sourceProjectName = CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentProjectName(),
            linkField = CArABU.technicalservices.WorkspaceSettingsUtility.getLinkField(workspaceID);

        Ext.Array.each(records, function(r){
            if (r.get('_type').toLowerCase() !== 'task'){
                var overrides = {Project: destProjectRef},
                    formattedID = r.get('FormattedID');

                overrides[linkField] = CArABU.technicalservices.WorkspaceSettingsUtility.getLinkValue(r, sourceWorkspaceName,sourceProjectName, formattedID);
                promises.push(this.copyArtifact(r, overrides));
            }
        }, this);

        Deft.Promise.all(promises, this).then({
            success: function(){
                deferred.resolve();
            },
            failure: function(msg){
                deferred.reject(msg);
            },
            scope: this
        });
        return deferred;
    },
    _copyTasks: function(){
        var me = this,
            promises = [],
            deferred = Ext.create('Deft.Deferred'),
            destProjectRef = this.destinationProject.get('_ref'),
            destWorkspaceID = Rally.util.Ref.getOidFromRef(this.destinationProject.get('Workspace')._ref),
            sourceWorkspaceName = CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspaceName(),
            sourceProjectName = CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentProjectName(),
            linkField = CArABU.technicalservices.WorkspaceSettingsUtility.getLinkField(destWorkspaceID);

        this.logger.log('_copyTasks', linkField, destWorkspaceID);
        Ext.Array.each(this.sourceRecords, function(r){
            if (r.get('_type').toLowerCase() === 'task'){
                var parent = me._getTaskParentRef(r);
                if (parent){
                    me.logger.log('parentRef', parent);
                    var overrides = {Project: destProjectRef};
                    overrides["WorkProduct"] = parent;
                    overrides[linkField] = CArABU.technicalservices.WorkspaceSettingsUtility.getLinkValue(r,sourceWorkspaceName,sourceProjectName);
                    promises.push(function(){ return me.copyArtifact(r, overrides); });
                }
            }
        }, this);

        Deft.Chain.sequence(promises, this).then({
            success: function(){
                deferred.resolve();
            },
            failure: function(msg){
                deferred.reject(msg);
            },
            scope: this
        });
        return deferred;
    },
    _stitchArtifacts: function(){
        var deferred = Ext.create('Deft.Deferred');

        //stitch non-tasks to parents:
        //userstory to userstory parent
        //userstory to portfolio item
        //portfolio item to portfolio item
        var updateRecords = [];

        this._populateDestinationParents(this.recordHash);

        Ext.Array.each(this.sourceRecords, function(r){
            var sourceID = r.get('ObjectID'),
                obj = this.recordHash[sourceID];

            if (obj && obj.destinationParent && obj.destinationRecord){
                 obj.destinationRecord.set(obj.destinationParentField, obj.destinationParent );
                updateRecords.push(obj.destinationRecord);
            }
        }, this);

        this.logger.log('_stitchArtifacts', updateRecords);

        if (updateRecords && updateRecords.length > 0) {

            var promises = [], me = this;
            Ext.Array.each(updateRecords, function (rec) {
                promises.push(function() {var r = rec; return me._saveRecord(r);});
            });
            return Deft.Chain.sequence(promises);

        } else {
            deferred.resolve();
        }
        //if (updateRecords && updateRecords.length > 0){
        //    var bulkUpdateStore = Ext.create('Rally.data.wsapi.batch.Store', {
        //        data: updateRecords
        //    });
        //
        //    bulkUpdateStore.sync({
        //        success: function(batch) {
        //            deferred.resolve();
        //        },
        //        failure: function(batch){
        //            deferred.reject();
        //        }
        //    });
        //} else {
        //    deferred.resolve();
        //}

        return deferred;
    },
    _saveRecord: function(record){
        var deferred = Ext.create('Deft.Deferred');

        record.save({
            callback: function(result, operation){
                if (operation.wasSuccessful()){
                    deferred.resolve();
                } else {
                    deferred.reject("Failed to save record: " + operation && operation.error && operation.error.errors.join(','));
                }
            }
        });
        return deferred;
    },
    _updateSourceLinks: function(){
        var sourceLinkField = CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspaceLinkField(),
            deferred = Ext.create('Deft.Deferred'),
            workspaceName = this.destinationProject.get('Workspace')._refObjectName,
            projectName = this.destinationProject.get('Name'),
            updates = [];

        Ext.Object.each(this.recordHash, function(key, obj){
            var sourceLinkValue = CArABU.technicalservices.WorkspaceSettingsUtility.getLinkValue(obj.destinationRecord,workspaceName,projectName);
            obj.sourceRecord.set(sourceLinkField, sourceLinkValue);
            updates.push(obj.sourceRecord);
        }, this);

        this.logger.log('_updateSourceLinks', updates);
        var bulkUpdateStore = Ext.create('Rally.data.wsapi.batch.Store', {
            data: updates
        });

        bulkUpdateStore.sync({
            success: function(batch) {
                deferred.resolve();
            },
            failure: function(batch){
                deferred.reject();
            }
        });
        return deferred;

    },
    _populateDestinationParents: function(recordHash){
        //TODO, if we wanted to search the destination for a parent (assuming it was copied at an earlier date), this will allow us to do that and link up.
        Ext.Object.each(recordHash, function(key, obj){
            if (obj.sourceRecord.get('_type') !== 'task'){
                var parent = obj.sourceRecord.get('Parent') || obj.sourceRecord.get('PortfolioItem') || null;
                if (parent && parent.ObjectID && recordHash[parent.ObjectID] && recordHash[parent.ObjectID].destinationRecord){
                    var parentDestinationRecord = recordHash[parent.ObjectID].destinationRecord;
                    obj.destinationParent = Ext.String.format("/{0}/{1}", parentDestinationRecord.get('_type'), parentDestinationRecord.get('ObjectID'));
                    obj.destinationParentField = this._getParentField(obj.destinationRecord, recordHash[parent.ObjectID].destinationRecord);
                }
            }
        }, this);
        this.logger.log('_populateDestinationParent', recordHash);
    },
    _getParentField: function(child, parent){
        var childType = child.get('_type'),
            parentType = parent.get('_type');

        if (this._isPortfolioItem(parentType) && !this._isPortfolioItem(childType)){
            return "PortfolioItem";
        }
        return "Parent";

    },
    _isPortfolioItem: function(type){
        return /portfolioitem/.test(type.toLowerCase());
    },
    //_restoreStates: function(){
    //    var deferred = Ext.create('Deft.Deferred');
    //    //TODO:  I'm not sure this is going to be a problem...
    //    deferred.resolve();
    //
    //    return deferred;
    //},
    _getTaskParentRef: function(sourceTaskObject){

        var sourceParent = sourceTaskObject.get('WorkProduct').ObjectID;
        if (this.recordHash[sourceParent] && this.recordHash[sourceParent].destinationRecord){
            return this.recordHash[sourceParent].destinationRecord.get('ObjectID');
        }
        return null;
    },
    _getModel: function(type){
        return this.modelHash[type.toLowerCase()] || null;
    },
    copyArtifact: function(record, overrides){
        var deferred = Ext.create('Deft.Deferred'),
            sourceOid = record.get('ObjectID');
        this.logger.log('copyArtifact', record.get('FormattedID'), record.get('_type'), this.modelHash);

        this.recordHash[sourceOid] = {
            sourceRecord: record,
            sourceParent: null,
            destinationRecord: null,
            destinationParent: null,
            error: null
        };

        var model = this._getModel(record.get('_type'));
        if (!model){
            //Todo handle error
        }

        this.copiedCount++;
        this.fireEvent('copystatus', Ext.String.format("Copying {0} of {1} artifacts.", this.copiedCount, this.totalCount));

        var fields = this._getFieldsToCopy(record, overrides);
        this.logger.log('fieldstocopy', fields);

        Ext.create(model, fields).save({
            callback: function(result, operation){
                this.logger.log('copyArtifact callback',record.get('FormattedID'), operation.wasSuccessful(), result, operation);
                if (operation.wasSuccessful()){
                    if (!result.get('FormattedID')){
                        //We need to reload to get the formatted id for some weird reason
                        model.load(result.get('ObjectID'),{
                            callback: function(loadedResult, operation){
                                if (operation.wasSuccessful()){
                                    this.recordHash[sourceOid].destinationRecord = loadedResult;

                                } else {
                                    this.recordHash[sourceOid].destinationRecord = result;
                                    this.recordHash[sourceOid].error = operation.error.errors.join(',');
                                }
                                deferred.resolve();
                            },
                            scope: this
                        });
                    } else {
                        this.recordHash[sourceOid].destinationRecord = result;
                        deferred.resolve();
                    }

                } else {
                    this.recordHash[sourceOid].destinationRecord = result;
                    this.recordHash[sourceOid].error = operation.error.errors.join(',');
                    deferred.reject(operation.error.errors.join(','));
                }
            },
            scope: this
        });
        return deferred;
    },
    _getFieldsToCopy: function(record, overrides){
        var sourceFields = record.getFields(),
            sourceType = record.get('_type'),
            destWorkspaceRef = this.destinationProject.get('Workspace')._ref,
            copyableFields = _.filter(sourceFields, this._fieldIsCopyable, this),
            fieldHash = {};

        this.logger.log('getFieldsToCopy',copyableFields);

        Ext.Array.each(copyableFields, function(f){
            //If there is a mapping, we need to get the mapped value
            var val = record.get(f.name) || null;

            if (Ext.isObject(val)){
                val = val._refObjectName;
            }

            var mappedVal = CArABU.technicalservices.WorkspaceSettingsUtility.getMappedValue(record, f.name, destWorkspaceRef);
            this.logger.log('copying fields', f.name, val, mappedVal);

            this.logger.log('field', f.name, f.attributeDefinition.AttributeType, val,record.get(f.name), mappedVal);

            if (mappedVal){
                fieldHash[f.name] = mappedVal;
            }
        }, this);

        Ext.Object.each(overrides, function(key, val){
            fieldHash[key] = val;
        });
        this.logger.log('fieldHash', fieldHash);
        return fieldHash;
    },
    _fieldIsCopyable: function(field){

        if (Ext.Array.contains(this.copyFields, field.name) && !field.readOnly){
            return true;
        }
        return false;
    }

});
