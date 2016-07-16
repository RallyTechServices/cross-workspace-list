Ext.define('CA.technicalservices.BulkMenuItem.xWorkspaceCopyBase', {
    alias: 'widget.bulkmenuitemxworkspacecopybase',
    extend: 'Rally.ui.menu.bulk.MenuItem',

    config: {

        handler: function () {
            this._showOptions();
        }
    },
    _showOptions: function() {
        var dlg = Ext.create('CA.technicalservices.xWorkspaceCopyDialog',{
            title: "Select Destination Project",
            workspaceSettings: this.workspaceSettings,
            context: this.context
        });
        dlg.on('optionschosen', this._doAction, this);
        dlg.show();
    },
    _doAction: function(options){

        this._loadRecordsToCopy().then({
            success: function(records){
                this.totalCount = records.length;
                this._copyRecords(records, options);
            },
            failure: function(errMsg){
                this.onSuccess([],this.records,[errMsg]);
            },
            scope: this
        });
    },
    _copyRecords: function(records, options){
        var copier = Ext.create('CArABU.technicalservices.ArtifactCopier',{
            workspaceSettings: this.workspaceSettings,
            copyFields: this.copyFields,
            context: this.context,
            listeners: {
                copyerror: function(msg){
                    console.log('copyerror', msg);
                    Rally.ui.notify.Notifier.showError({message: msg});
                },
                copystatus: function(msg){
                    Rally.ui.notify.Notifier.show({message: msg});
                    console.log('copystatus',msg);
                },
                copycomplete: function(){
                    console.log('copycomplete',  records);
                    this.onSuccess(records, [], []);
                },
                scope: this
            }
        });
        copier.copyRecords(records, options.project);
    },
    onSuccess: function (successfulRecords, unsuccessfulRecords, errorMessages) {

        var message = successfulRecords.length + (successfulRecords.length === 1 ? ' item has ' : ' items have ');
        if(successfulRecords.length === this.totalCount) {
            Rally.ui.notify.Notifier.show({
                message: message +  'been created in the selected workspace and project.'
            });
        } else {
            if (successfulRecords.length === 0){
                message = "0 items have been created in the selected workspace and project."
            }

            Rally.ui.notify.Notifier.showWarning({
                message: message + ', but ' + unsuccessfulRecords.length + ' failed: ' + errorMessages.join('<br/>'),
                useHTML: true
            });
        }

        Ext.callback(this.onActionComplete, null, [successfulRecords, unsuccessfulRecords]);
    }
});