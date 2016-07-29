#Cross Workspace List

![ScreenShot](/images/cross-workspace-list.png)

###Requirements for app to run:
* Link Field needs to be the same name for all copyable types in the workspace.
* Copyable types are:  Portfolio Item, User Story and Task
* At least 1 destination workspace needs to be configured via the App Settings.  See the App Settings section below.  
* A link field for the current workspace needs to be selected.  

#### Copying Artifacts
Artifacts can be copied in bulk by using the Bulk Edit Menu on the Cross Workspace List.  There are 2 options available:
(1) Deep Copy to Workspace..
(2) Copy to Workspace...

Deep Copy to workspace will copy the entire hierarchy of copyable artifacts and link them together in the destination workspace.  

Copy to Workspace will only copy the selected artifacts.  

The Copy options will not be available if:
*  The artifact isn't available in the destination workspace
*  The artifact is already linked.  This is determined by checking the link field.  

Tasks cannot be copied to the destination workspace unless their parent stories are also copied at the same time.  

Here is a video of how to setup the cross workspace app.  http://screencast.com/t/221mgpEF

### List of fields that will be synced and copied with this app: 

####Portfolio Items
* Name
* State (Mapping required via App Settings for each configured workspace)
* Description 
* PlannedStartDate
* PlannedEndDate
 
####User Stories
* Name
* Description
* ScheduleState
 
####Tasks
* Name
* Description
* State

###Syncing Items
Pressing the Sync button will sync any linked items currently showing in the View and their descendants (if those are also linked).  

If the contents of the link field is deleted in the source (the current workspace), then the item will no longer be linked. 
 
The sync goes in both directions.  Whatever item was updated last will win, regardless of the field that was updated*
This may be an enhancement request, to find the field that was updated last and sync that individually.  

### Setting up the App 
At least 1 destination workspace needs to be configured for the app to run.  You will see a message if it is not setup.  

To add a workspace, go to app settings.
![ScreenShot](/images/app-settings.png)

First, select a link field for the current workspace.  This needs to be a custom string field that is setup on all copyable objects (Portfolio Item, User Story and Task).  
If you select a field that does not exist on all copyable objects, you will get a message when you try to run the app.  

To add a destination workspace, click the Add Workspace (you can also Edit and Delete workspace configurations using the gear menu).  

![ScreenShot](/images/add-workspace-settings.png)
For each destination workspace, you will need to select a Link field (that exists on all copyable types) and mappings for all of the Portfolio Item types states.  

If you choose to map a State for a particular portfolio item type that does not exist on that portfolio item type, you will be prompted to select a mapping for that state.  Please select a state that exists for the portfolio item type in the destination workpsace.  

## Development Notes

### First Load

If you've just downloaded this from github and you want to do development, 
you're going to need to have these installed:

 * node.js
 * grunt-cli
 * grunt-init
 
Since you're getting this from github, we assume you have the command line
version of git also installed.  If not, go get git.

If you have those three installed, just type this in the root directory here
to get set up to develop:

  npm install

### Structure

  * src/javascript:  All the JS files saved here will be compiled into the 
  target html file
  * src/style: All of the stylesheets saved here will be compiled into the 
  target html file
  * test/fast: Fast jasmine tests go here.  There should also be a helper 
  file that is loaded first for creating mocks and doing other shortcuts
  (fastHelper.js) **Tests should be in a file named <something>-spec.js**
  * test/slow: Slow jasmine tests go here.  There should also be a helper
  file that is loaded first for creating mocks and doing other shortcuts 
  (slowHelper.js) **Tests should be in a file named <something>-spec.js**
  * templates: This is where templates that are used to create the production
  and debug html files live.  The advantage of using these templates is that
  you can configure the behavior of the html around the JS.
  * config.json: This file contains the configuration settings necessary to
  create the debug and production html files.  
  * package.json: This file lists the dependencies for grunt
  * auth.json: This file should NOT be checked in.  Create this to create a
  debug version of the app, to run the slow test specs and/or to use grunt to
  install the app in your test environment.  It should look like:
    {
        "username":"you@company.com",
        "password":"secret",
        "server": "https://rally1.rallydev.com"
    }
  
### Usage of the grunt file
####Tasks
    
##### grunt debug

Use grunt debug to create the debug html file.  You only need to run this when you have added new files to
the src directories.

##### grunt build

Use grunt build to create the production html file.  We still have to copy the html file to a panel to test.

##### grunt test-fast

Use grunt test-fast to run the Jasmine tests in the fast directory.  Typically, the tests in the fast 
directory are more pure unit tests and do not need to connect to Rally.

##### grunt test-slow

Use grunt test-slow to run the Jasmine tests in the slow directory.  Typically, the tests in the slow
directory are more like integration tests in that they require connecting to Rally and interacting with
data.

##### grunt deploy

Use grunt deploy to build the deploy file and then install it into a new page/app in Rally.  It will create the page on the Home tab and then add a custom html app to the page.  The page will be named using the "name" key in the config.json file (with an asterisk prepended).

To use this task, you must create an auth.json file that contains the following keys:
{
    "username": "fred@fred.com",
    "password": "fredfredfred",
    "server": "https://us1.rallydev.com"
}

(Use your username and password, of course.)  NOTE: not sure why yet, but this task does not work against the demo environments.  Also, .gitignore is configured so that this file does not get committed.  Do not commit this file with a password in it!

When the first install is complete, the script will add the ObjectIDs of the page and panel to the auth.json file, so that it looks like this:

{
    "username": "fred@fred.com",
    "password": "fredfredfred",
    "server": "https://us1.rallydev.com",
    "pageOid": "52339218186",
    "panelOid": 52339218188
}

On subsequent installs, the script will write to this same page/app. Remove the
pageOid and panelOid lines to install in a new place.  CAUTION:  Currently, error checking is not enabled, so it will fail silently.

##### grunt watch

Run this to watch files (js and css).  When a file is saved, the task will automatically build and deploy as shown in the deploy section above.

