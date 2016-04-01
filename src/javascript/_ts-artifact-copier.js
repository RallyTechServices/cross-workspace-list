Ext.define('Rally.technicalservices.artifactCopier',{
    logger: new Rally.technicalservices.Logger(),

    mixins: {
        observable: 'Ext.util.Observable'
    },
    /**
     * Passed config:
     *    fieldsToCopy: ['Name','Owner','Description'],
     *    linkField: this.getSetting('link_field'),
     */

    constructor: function(config){
        Ext.apply(this,config);

        this.mixins.observable.constructor.call(this, config);

        this.addEvents(
            'artifactcreated',
            'artifactupdated',
            'copyerror',
            'updateerror',
            'validationfailed',
            'updatewarning'
        );
    },

    copy: function(targetWorkspace, targetProject, artifact){
        this._getModel(targetWorkspace, targetProject, artifact.get('_type')).then({
            scope: this,
            success: function(model){
                var validation_issues = this._validateFields(this.fieldsToCopy, model, artifact);
                if (validation_issues && validation_issues.length > 0 ){
                    this.fireEvent('copyerror', validation_issues);
                } else {
                    this._createArtifact(model,artifact, targetWorkspace, targetProject);
                }
            },
            failure: function(obj){
                this.fireEvent('copyerror', this.buildErrorMessage('Error getting the model: ', obj));
            }
        });
    },
    updateFromLinkedArtifact: function(artifact_to_be_updated){

        var link = artifact_to_be_updated.get(this.linkField),
            matches = /<a.*href="\/#\/(\d+).*\/detail\/userstory\/(\d+)">(.*)<\/a>/.exec(link),
            objectID = null,
            projectOid = null,
            store_context = null,
            friendly_text = null;

        if (!matches){
            this.fireEvent('updateerror', this.buildInvalidLinkData(artifact_to_be_updated));
            return;
        }

        if (matches){
            objectID = matches[2] || null;
            projectOid =matches[1] || null;
            store_context = this._getLinkedContext(projectOid);
            friendly_text = matches[3] || 'Unknown';
        }

        var filters = [{property: 'ObjectID', value: objectID}];

        if (store_context.workspace == null || store_context.project==null){
            this.fireEvent('updateerror', this.buildNoLinkedContextMessage(artifact_to_be_updated,friendly_text));
            return;
        }
        console.log('_getLinkedArtifactInfo', objectID,store_context);

        var store = Ext.create('Rally.data.wsapi.Store',{
            fetch: this.fieldsToCopy,
            filters: filters,
            context: store_context,
            model: 'hierarchicalrequirement'
        });
        store.load({
            scope: this,
            callback: function(records, operation){
                if (operation.wasSuccessful()){
                    if (records && records.length > 0) {
                        this._updateArtifact(artifact_to_be_updated, records[0]);
                    } else {
                        this.fireEvent('updatewarning', Ext.String.format('No record found for linked object {0} (ObjectID = ).  The item may have been moved or deleted.',friendly_text, objectID));
                    }
                } else {
                    this.fireEvent('updateerror', this.buildErrorMessage(Ext.String.format('Error loading linked object {0}',friendly_text), operation));
                }
            }
        });
    },
    _getLinkedContext: function(projectOid){

        var project = null, workspace = null;
        Ext.Array.forEach(this.context.getPermissions().userPermissions, function(permission) {
            if(permission.Workspace) {

                if (projectOid == Rally.util.Ref.getOidFromRef(permission._ref)){
                    project = permission._ref;
                    workspace = permission.Workspace;
                    return false;
                }
            }
        });
        return {workspace: workspace, project: project};
    },
    _updateArtifact: function(artifact_to_be_updated, source_artifact) {

        _.each(this.fieldsToCopy, function (f) {
            artifact_to_be_updated.set(f, this._getFieldValue(source_artifact, f));
        }, this);

        this.logger.log('_updateArtifact (dirty)', artifact_to_be_updated, source_artifact, this.fieldsToCopy);
        artifact_to_be_updated.save({
            scope: this,
            callback: function (record, operation) {
                this.logger.log('_updateArtifact callback returned',record, operation);
                if (operation.wasSuccessful()) {
                    this.fireEvent('artifactupdated', record);
                } else {
                    this.fireEvent('updateerror', this.buildErrorMessage(Ext.String.format('Error updating artifact {0}', artifact_to_be_updated.get('FormattedID')), operation));
                }
            }
        });
    },
    _createArtifact: function(model, artifact, targetWorkspace, targetProject){

        var fields = {};
        _.each(this.fieldsToCopy, function(f){
            fields[f] = this._getFieldValue(artifact, f);
        }, this);
        fields[this.linkField] = this._getLinkValue(artifact, this.context.getWorkspace(), this.context.getProject());

        this.logger.log('_createArtifact', fields);
        var record = Ext.create(model, fields);
        record.save({
            scope: this,
            callback: function(record, operation){
                if (operation.wasSuccessful()){
                    this.fireEvent('artifactcreated',record);
                    this._linkArtifacts(artifact, record, targetWorkspace, targetProject);
                } else {
                    this.logger.log('_createArtifact error (operation, artifact, new record)', operation, artifact, record);
                    this.fireEvent('copyerror',this.buildErrorMessage('Error saving artifact', operation));
                }
            }
        });
    },
    _validateFields: function(fields_to_copy, model, artifact){
        var missing_fields = [];
        if (!model.getField(this.linkField)){
            return this.buildLinkFieldMissingMessage(artifact.getField(this.linkField).displayName);
        }

        _.each(fields_to_copy, function(f){
            if (!model.getField(f)){
                missing_fields.push(artifact.getField(f).displayName);
            }
        });
        if (missing_fields.length > 0){
            return this.buildFieldValidationErrorMessage(missing_fields);
        }
        return null;
    },
    _linkArtifacts: function(artifact, newArtifact, targetWorkspace, targetProject){
           this.logger.log('_linkArtifacts')
           artifact.set(this.linkField,this._getLinkValue(newArtifact, targetWorkspace, targetProject));
           artifact.save({
               scope: this,
               callback: function (record, operation){
                    if (operation.wasSuccessful()){
                        this.fireEvent('artifactupdated',record);
                    } else {
                        this.fireEvent('updateerror',this.buildErrorMessage('Error updating linked field.',operation));
                    }
                }
           });
    },
     _getLinkValue: function(artifact, workspace, project){
        var workspaceName = workspace.Name,
            projectName = project.Name,
            link_text = Ext.String.format('[{0}][{1}] {2}',workspaceName, projectName, artifact.get('FormattedID'));

         return Rally.nav.DetailLink.getLink({
            record: artifact,
            text: link_text
        });
    },
    _getFieldValue: function(artifact, field){
        console.log('--',artifact.get(field), artifact.getField(field));
        var field_obj = artifact.getField(field);
        if (field_obj && field_obj.attributeDefinition && field_obj.attributeDefinition.AttributeType == 'OBJECT'){
            return artifact.get(field)._ref || null;
        }
        return artifact.get(field) || null;
    },
    _getModel: function(targetWorkspace, targetProject, modelType){
        var deferred = Ext.create('Deft.Deferred');
        Rally.data.ModelFactory.getModel({
            type: modelType,
            context: {
                workspace: targetWorkspace._ref,
                project: targetProject._ref
            },
            scope: this,
            success: function(model) {
                deferred.resolve(model);
            },
            failure: function(obj){
                deferred.reject(obj);
            }
        });
        return deferred;
    },
    buildErrorMessage: function(msg, operation){
        return Ext.String.format('{0}:  [{1}]',msg, operation.error.errors.join(','));
    },
    buildLinkFieldMissingMessage: function(field){
         return Ext.String.format('Validation Error:  Link field [{0}] is missing in the destination.',field);
    },
    buildFieldValidationErrorMessage: function(fields){
        return Ext.String.format("Validation Error(s):  Fields to copy are missing from the destination: [{0}]",fields.join(','));
    },
    buildNoLinkedContextMessage: function(artifact, friendly_text){
        return Ext.String.format("No valid context found for {0}, needed to update {1}.  Please verify that you have editor or higher permissions to the linked project and workspace.", friendly_text, artifact.get('FormattedID'));
    },
    buildInvalidLinkData: function(artifact){
        return Ext.String.format("Could not get valid linked object information from {0}.  Please inspect the revision history to see if the data for the link field {1} has changed.", artifact.get('FormattedID'), this.linkField);
    }
});
