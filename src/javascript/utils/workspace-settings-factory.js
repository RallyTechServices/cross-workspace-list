Ext.define('CArABU.technicalservices.WorkspaceSettingsUtility',{
    singleton: true,

    syncFields: {
        hierarchicalrequirement: ['Name','Description','ScheduleState'],
        task: ['Name','Description','State'],
        portfolioitem: ['Name','State','Description','PlannedStartDate','PlannedEndDate']
    },
    syncFetchFields: ['LastUpdateDate','Workspace','ObjectID','FormattedID'],
    copyFields: ['ObjectID','FormattedID','Name','ScheduleState','Description','PlanEstimate','State','PlannedStartDate','PlannedEndDate'],

    context: null,
    workspaceSettingsHash: null,


    initializeWorkspaceConfiguration: function(workspaceSettingsObject){
        var deferred = Ext.create('Deft.Deferred');

        Deft.Chain.pipeline([
            function(){ return CArABU.technicalservices.WorkspaceSettingsUtility.fetchModels(workspaceSettingsObject); },
            CArABU.technicalservices.WorkspaceSettingsUtility.fetchStateAllowedValues
        ]).then({
            success: function(workspaceSettingsObject){
                deferred.resolve(workspaceSettingsObject);
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred;

    },
    fetchModels: function(workspaceConfiguration){
        var deferred = Ext.create('Deft.Deferred');

        var workspaceRef = workspaceConfiguration._ref,
            context = { workspace: workspaceRef, project: null },
            models = ['UserStory','Task'];

        CArABU.technicalservices.WsapiToolbox.fetchPortfolioItemTypes(context).then({
            success: function(portfolioItemTypes){
                var portfolioItemModels = _.map(portfolioItemTypes, function(p){
                    return p.get('TypePath');
                });
                workspaceConfiguration.portfolioItemTypes = portfolioItemModels;

                models = models.concat(portfolioItemModels);
                Rally.data.ModelFactory.getModels({
                    types: models,
                    context: context,
                    success: function(models){
                        workspaceConfiguration.models = models;
                        deferred.resolve(workspaceConfiguration);
                    },
                    failure: function(errorMsg){
                        deferred.reject(errorMsg);
                    },
                    scope: this
                });
            },
            failure: function(errorMsg){
                deferred.reject(errorMsg);
            },
            scope: this
        });
        return deferred;
    },
    fetchStateAllowedValues: function(workspaceConfiguration){
        var deferred = Ext.create('Deft.Deferred'),
            promises = [];

        Ext.Array.each(workspaceConfiguration.portfolioItemTypes, function(m){
            promises.push(CArABU.technicalservices.WsapiToolbox.fetchAllowedValues(workspaceConfiguration.models[m],'State'));
        }, this);

        workspaceConfiguration.portfolioItemStates = {};
        Deft.Promise.all(promises).then({
            success: function(results){
                for (var i=0; i<workspaceConfiguration.portfolioItemTypes.length; i++){
                    workspaceConfiguration.portfolioItemStates[workspaceConfiguration.portfolioItemTypes[i].toLowerCase()] = {};
                    Ext.Array.each(results[i], function(r){
                        workspaceConfiguration.portfolioItemStates[workspaceConfiguration.portfolioItemTypes[i].toLowerCase()][r.get('StringValue')] = r.get('_ref');
                    });
                }
                deferred.resolve(workspaceConfiguration);
            },
            failure: function(msg){
                deferred.reject(msg);
            },
            scope: this
        });
        return deferred;
    },
    getSettingsDataFields: function(){
        return ['ObjectID','Name','linkField','mappings'];
    },
    getDestinationWorkspaceConfigurations: function(){
        var workspaceSettingsHash = CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash,
            currentWorkspaceID = CArABU.technicalservices.WorkspaceSettingsUtility.context.getWorkspace().ObjectID;
        var workspaces = [];

        Ext.Object.each(workspaceSettingsHash, function(wOid, w){
            if (Number(wOid) !== Number(currentWorkspaceID)){
                workspaces.push(w);
            }
        });
        return workspaces;
    },
    initializeWorkspaceSettingsHash: function(encodedWorkspaceSettings, context, currentWorkspaceLinkField){
        var workspaceSettingsHash = {},
            promises = [],
            deferred = Ext.create('Deft.Deferred');

        if (encodedWorkspaceSettings && !_.isEmpty(encodedWorkspaceSettings)){
            if (Ext.isString(encodedWorkspaceSettings)){
                workspaceSettingsHash = Ext.JSON.decode(encodedWorkspaceSettings);
            } else {
                workspaceSettingsHash = Ext.clone(encodedWorkspaceSettings);
            }
        }

        workspaceSettingsHash[context.getWorkspace().ObjectID] = {
            _ref: context.getWorkspace()._ref,
            ObjectID: context.getWorkspace().ObjectID,
            Name: context.getWorkspace().Name,
            linkField: currentWorkspaceLinkField
        };

        Ext.Object.each(workspaceSettingsHash, function(workspaceOid, settingsObject){
            promises.push(CArABU.technicalservices.WorkspaceSettingsUtility.initializeWorkspaceConfiguration(settingsObject));
        });

        Deft.Promise.all(promises).then({
            success: function(results){
                CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash = workspaceSettingsHash;
                deferred.resolve(workspaceSettingsHash);
            },
            failure: function(msg){
                deferred.reject(msg);
            },
            scope: this
        });
        return deferred;

    },
    getCopyableTypes: function(type){
        var piTypes = CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspacePortfolioItemTypes(),
            types = [];

        var maxPILevels = 0;
        Ext.Array.each(CArABU.technicalservices.WorkspaceSettingsUtility.getDestinationWorkspaceConfigurations(), function(w){
            maxPILevels = Math.max(w.portfolioItemTypes.length, maxPILevels);
        });
        maxPILevels = Math.min(maxPILevels, piTypes.length);

        for (var i=0; i<maxPILevels; i++){
            types.push(piTypes[i]);
            if (piTypes[i].toLowerCase === type.toLowerCase()){
                i = piTypes.length;
            }
        }

        types = types.concat(['hierarchicalrequirement','task']);
        return types;
    },
    getCurrentWorkspace: function(){
        var workspaceId = CArABU.technicalservices.WorkspaceSettingsUtility.context.getWorkspace().ObjectID;
        return CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash[workspaceId];
    },
    getCurrentWorkspacePortfolioItemTypes: function(){
      return CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspace().portfolioItemTypes;
    },
    getLinkField: function(workspaceID){
        return CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash[workspaceID] &&
            CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash[workspaceID].linkField;
    },
    getCurrentWorkspaceLinkField: function(){
        return CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspace().linkField;
    },
    getArtifactModelNames: function(){
        return this.getCurrentWorkspacePortfolioItemTypes().concat(['HierarchicalRequirement','Task']);
    },
    getSettingsDataFields: function(){
        return ['ObjectID','Name','linkField','mappings','portfolioItemTypes','portfolioItemStates','models','_ref'];
    },
    validateSetting: function(record, maxPortfolioLevels){
        var errors = [],
            currentPITypes = CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspacePortfolioItemTypes();

        maxPortfolioLevels = maxPortfolioLevels || currentPITypes.length;

        if (!record.linkField){
            errors.push("Please select a link field.");
        }
        for (var i=0; i<maxPortfolioLevels; i++){
            //This is confusing becuase the mappings are using the current workspace pi types for reference.
            //We should probably use indexes instead of types...
            var mappings = record.mappings && record.mappings[currentPITypes[i].toLowerCase()];
            if (!mappings){
                //Even though we are using the current, we want to show the
                errors.push("Please provide valid mappings for " + record.portfolioItemTypes[i]);
            } else {
                Ext.Object.each(mappings, function(field, fieldMapping){
                    Ext.Object.each(fieldMapping, function(mapFrom, mapTo){
                        if (!mapTo || mapTo.length === 0){
                            errors.push("Please select a mapping for " + field + " value " + mapFrom);
                        }
                    });
                });
            }
        }
        return errors;
    },
    getValidLinkFields: function(workspace){
        var validFields = [];
        if (!workspace){
            workspace = CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspace();
        }

        Ext.Object.each(workspace.models, function(key, m){
            var fields = [];
            Ext.Array.each(m.getFields(), function(f){
                if (f.custom && f.attributeDefinition
                    && f.attributeDefinition.AttributeType === 'STRING'
                    && !f.readOnly){
                    fields.push(f.name);
                }
            });
            if (validFields.length === 0){
                validFields = fields;
            }
            validFields = _.intersection(fields, validFields);
        });

        var validFieldObjects = [];
        Ext.Array.each(validFields, function(f){
            validFieldObjects.push(workspace.models['UserStory'].getField(f));
        }, this);

        return validFieldObjects
    },

    getSourceType: function(destinationType, destinationWorkspaceID){

        if (/portfolioitem/.test(destinationType.toLowerCase())) {

            var destWksp = CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash[destinationWorkspaceID],
                ordinal = -1;

            for (var i = 0; i < destWksp.portfolioItemTypes.length; i++) {
                if (destWksp.portfolioItemTypes[i].toLowerCase() === destinationType.toLowerCase()) {
                    ordinal = i;
                }
            }
            if (ordinal > -1){
                return CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspacePortfolioItemTypes()[ordinal];
            }
        }
        return destinationType;
    },
    getValueMap: function(workspaceRef, type, field){

        var workspaceID = Rally.util.Ref.getOidFromRef(workspaceRef),
            wksp = CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash[workspaceID];
        var sourceType = CArABU.technicalservices.WorkspaceSettingsUtility.getSourceType(type, workspaceID).toLowerCase();
        return wksp.mappings && wksp.mappings[sourceType] && wksp.mappings[sourceType][field] || null;
    },
    getCurrentProjectName: function(){
        return CArABU.technicalservices.WorkspaceSettingsUtility.context.getProject().Name;
    },
    getCurrentWorkspaceName: function(){
        return CArABU.technicalservices.WorkspaceSettingsUtility.context.getWorkspace().Name;
    },
    getWorkspaceForProject: function(projectID){
        var workspaceID = null;
        Ext.Object.each(this.workspaceStores, function(wOid, w){
            if (w.projectIDs && Ext.Array.contains(w.projectIDs, Number(projectID))){
                workspaceID = w.ObjectID;
                return false;
            }
        });
        return workspaceID;
    },
    getRefMap: function(workspaceRef, type, fieldName){
        var oid = Rally.util.Ref.getOidFromRef(workspaceRef),
            workspace = CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash[oid];

        //TODO: make this smarter and more generic if we add other mapping fields
        if (/portfolioitem/.test(type.toLowerCase()) && fieldName === "State"){
            return workspace.portfolioItemStates;
        }
        return null;
    },
    getMappedValue: function(sourceRecord, fieldName, destWorkspaceRef){
        var sourceType = sourceRecord.get('_type').toLowerCase(),
            sourceValue = sourceRecord.get(fieldName),
            sourceWorkspaceRef = sourceRecord.get('Workspace')._ref,
            context = {workspace: destWorkspaceRef};

        if (Ext.isObject(sourceValue)){
            sourceValue = sourceValue._refObjectName;
        }

        if (!sourceValue){
            return null;
        }

        var valueMap = null,
            fromCurrent = true;
        if (CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspace().ObjectID === Rally.util.Ref.getOidFromRef(destWorkspaceRef)){
            fromCurrent = false;
            context = {workspace: sourceWorkspaceRef};
            valueMap = CArABU.technicalservices.WorkspaceSettingsUtility.getValueMap(sourceWorkspaceRef, sourceType, fieldName);
        } else {
            valueMap = CArABU.technicalservices.WorkspaceSettingsUtility.getValueMap(destWorkspaceRef, sourceType, fieldName);
        }

        if (!valueMap){
            return sourceValue;
        }

        //valueMap is currentWorkspaceValue => otherWorkspaceValue
        var newVal = null;

        if (fromCurrent){
            newVal = valueMap[sourceValue] || null;
        } else {
            Ext.Object.each(valueMap, function(currentVal, otherVal){
                if (otherVal === sourceValue){
                    newVal = currentVal;
                }
            });
        }

        var refMap = CArABU.technicalservices.WorkspaceSettingsUtility.getRefMap(destWorkspaceRef, sourceType, fieldName);
        if (refMap){
            var destType = CArABU.technicalservices.WorkspaceSettingsUtility.getDestinationModelType(sourceType,context).toLowerCase();
            return refMap[destType] && refMap[destType][newVal] || null;
        }

        return newVal;

    },
    getSyncFields: function(type){
        type = type.toLowerCase();
        if (/^portfolioitem/.test(type.toLowerCase())){
            type = "portfolioitem";
        }
        return CArABU.technicalservices.WorkspaceSettingsUtility.syncFields[type] || [];
    },
    getLinkValue: function(artifact, workspaceName, projectName, formattedID){

        var link_text = Ext.String.format('[{0}][{1}] {2}',workspaceName, projectName, artifact.get('FormattedID') || formattedID);
        return Rally.nav.DetailLink.getLink({
            record: artifact,
            text: link_text
        });
    },
    parseLinkValue: function(linkValue){
       var matches = /<a.*href=".*\/#\/(\d+).*\/detail\/.*\/(\d+)">(.*)<\/a>/.exec(linkValue),
           obj = {};

        if (matches){
            obj.objectID = matches[2] || null;
            obj.projectOid =matches[1] || null;
            obj.linkText = matches[3];

        }
        return obj;
    },
    getObjectIDFromLinkValue: function(linkValue){
        var obj = CArABU.technicalservices.WorkspaceSettingsUtility.parseLinkValue(linkValue);
        return obj.objectID || null;
    },
    getContextFromLinkValue: function(linkValue){
        var obj = CArABU.technicalservices.WorkspaceSettingsUtility.parseLinkValue(linkValue);

        if (obj.projectOid && obj.linkText){
            var linkTextMatches = /\[(.*)\]\[(.*)\].*/.exec(obj.linkText),
                workspaceOid = null;

            if (linkTextMatches && linkTextMatches[1]){
                var workspaceName = linkTextMatches[1];
                Ext.Object.each(CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash, function(oid, obj){
                    if (obj.Name === workspaceName){
                        workspaceOid = obj._ref;
                        return false;
                    }
                });
            }
            return {workspace: workspaceOid, project: "/project/" + obj.projectOid};
        }
        return null;
    },
    getDestinationModelType: function(sourceType, destinationContext, otherWorkspace){

        if (/portfolioitem/.test(sourceType.toLowerCase())){
            //This is a portfolio item
            var ordinal = -1;
            for (var i=0; i < CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspace().portfolioItemTypes.length; i++){
                if (sourceType.toLowerCase() === CArABU.technicalservices.WorkspaceSettingsUtility.getCurrentWorkspace().portfolioItemTypes[i].toLowerCase()){
                    ordinal = i;
                }
            }

            var destType = sourceType;
            if (!otherWorkspace){
                var workspaceOid = Rally.util.Ref.getOidFromRef(destinationContext.workspace);
                destType= CArABU.technicalservices.WorkspaceSettingsUtility.workspaceSettingsHash[workspaceOid].portfolioItemTypes[ordinal] || sourceType;
            } else {
                destType = otherWorkspace.portfolioItemTypes[ordinal] || sourceType;
                console.log('destType', destType);
            }

            return destType;
        }
        return sourceType;

    }
});
