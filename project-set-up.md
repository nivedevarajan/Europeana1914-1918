europeana 1914-1918 set-up
==========================
table of contents
-----------------
1. introduction
2. required libraries
3. suggested ruby install
4. setup the 1914-1918 project
5. configurations
6. environments
7. initializers
8. create db and populate with initial values
9. update the js localization files
10. clear js & css cache
11. install solr
12. start the server
13. secure the admin account
14. google usage statistics
15. some ruby extras
16. import a production db dump
17. upgrading pdf.js viewer
18. upgrading mediaelement
19. reset password on localhost
20. update thumbnails and dimmensions


introduction
------------
this document attempts to detail the installation requirements and tasks needed
in order to set-up a local developer environment for europeana’s 1914-1918 website.


required libraries
------------------
make sure all of the following libraries are installed. you can use the unix
pacakage manager apt-get or the mac os x package manager homebrew to install
them if they are not already installed.

* curl
* git
* mysql

the following libraries are required in order for ruby paperclip gem to work
properly

* ffmpeg
  for creating thumbnails from videos

* ImageMagick
  for thumbnail creation

* ghostscript
  for creating thumbnails for pdfs


suggested ruby install
----------------------
use rvm, http://rvm.io/
an article for ubuntu - http://ryanbigg.com/2010/12/ubuntu-ruby-rvm-rails-and-you/

### install rvm - ubuntu

```
curl -L get.rvm.io | bash -s stable --autolibs=packages
source ~/.rvm/scripts/rvm
rvm requirements
```

### install rvm - mac os x

rvm uses a package manager to insure dependencies are installed. mac os x does
not come with a package manager, thus here we are recommending [homebrew]
(http://mxcl.github.io/homebrew/). if rvm does not find a package manager it will
attempt to install and use macports.

```
curl -L get.rvm.io | bash -s stable --autolibs=homebrew --ignore-dotfiles
rvm requirements
```

the --ignore-dotfiles stops rvm from creating a .bash_profile and .bashrc file.
the functionality of these can be created manually as indicated below.

### .bash_profile

create or add to a ~/.bash_profile file the following.

```
nano ~/.bash_profile
# Load RVM into a shell session *as a function*
[[ -s "$HOME/.rvm/scripts/rvm" ]] && source "$HOME/.rvm/scripts/rvm"
```

### .bashrc
on a mac, instead of creating a .bashrc file with the following in it :
PATH=$PATH:$HOME/.rvm/bin you can create a file called rvm in /etc/paths.d with
the following contents in it :  

```
sudo nano /etc/paths.d rvm
/Users/your-username/.rvm/bin
```

### install ruby with rvm

any 1.9+ version should work

```
rvm install 1.9.3
```


setup the 1914-1918 project
===========================
clone the project
-----------------

```
git clone -o github https://github.com/europeana/Europeana1914-1918.git
```

create a gemset
---------------
create a gemset for the project

```
rvm gemset create 1914
```

.ruby-version file
------------------
create a .runby-version file. the .ruby-version file will make sure that rvm
switches to the ruby version specified in the file:

```
cd /Europeana1914-1918
nano .ruby-version
1.9.3
```

.ruby-gemset file
-----------------
create a .ruby-gemset file. the .ruby-gemset file will make sure that rvm
uses the gemset inidicated in the file:

``` 
cd /Europeana1914-1918
nano .ruby-gemset
1914
```

confirm ruby version and gemset
-------------------------------
confirm that the ruby version and gemset match what you expect

```
cd ..
cd /Europeana1914-1918
rvm info
```

bundle install
--------------
bundle install, installs several packages for ruby that the project requires.
mac os x may have an issue with xcrun. to overcome it [see this gist]
(https://gist.github.com/thelibrarian/5520597)

```
cd /Europeana1914-1918
bundle install
```


configurations
==============
the following commands assume that you are at the root path of the project

db config
---------
create a db config. edit the file as appropriate. make sure the socket location
is correct, e.g. /tmp/mysql.sock if you run into a error indicating
mysql2/client.rb:44:in `connect': can't convert Fixnum into String (TypeError)
placing quotes around the databasename, username or password in may resolve the
issue

```
cp config/database.yml.example config/database.yml
nano config/database.yml
```

sphinx config
-------------
if using sphinx, create a sphinx config file and edit the file as appropriate

```
cp config/sphinx.yml.example config/sphinx.yml
nano config/sphinx.yml
```

sass config (???)
-----------
```
cp config/sass.yml.example config/sass.yml
nano config/sass.yml
gem install compass 
```


environments
============
the following commands assume that you are at the root path of the project

environment config
-------------------------
create an environment config and edit as appropriate

```
cp config/environments/development.rb.example config/environments/development.rb
nano config/environments/development.rb
```


initializers
============
the following commands assume that you are at the root path of the project

create europeana config
-----------------------
create a europeana config file. edit the file and make sure it contains a valid
europeana api key. if you get an exception error : uninitialized constant
EuropeanaController::Europeana then this config has probably not been set properly.

```
cp config/initializers/europeana.rb.example config/initializers/europeana.rb
nano config/initializers/europeana.rb
````

search engine config
--------------------
create a search_engine config file. edit the file and make sure the recommended
settings are uncommented by removing the #

````
cp config/initializers/search_engine.rb.example config/initializers/search_engine.rb
nano config/initializers/search_engine.rb
````

search suggestions config
-------------------------
create a search_suggestions config file. edit the file and make sure the recommended
settings are uncommented by removing the #

````
cp config/initializers/search_suggestion.rb.example config/initializers/search_suggestion.rb
nano config/initializers/search_suggestion.rb
````

secret token
------------
create a secret token file. edit the file and make sure the token is a phrase of
at least 30 characters within quotes.

```
cp config/initializers/secret_token.rb.example config/initializers/secret_token.rb
nano config/initializers/secret_token.rb
```

thinking sphinx config
-----------------------
if using sphinx, create a thinking sphinx config file. edit it as appropriate.
```
cp config/initializers/thinking_sphinx.rb.example config/initializers/thinking_sphinx.rb
nano config/initializers/thinking_sphinx.rb
```


database
========
setup the database. the credentials from the config/database.yml will be used.
the database will be populated with 
```
bundle exec rake db:drop
bundle exec rake db:create
```

import db dump
--------------
if you want you can import a production db dump.

```
mysql -u developer -p db_name < db_dump.sql # import a production db dump
```

migrate the db
--------------
```
bundle exec rake db:migrate
```


update localization
===================
update the js localization files

```
bundle exec rake i18n:js:export
```


clear js & css cache
====================
```
bundle exec rake assets:expire
```


install solr
============
make sure mysql is running
bundle exec rails generate sunspot_rails:install
bundle exec rake sunspot:solr:start
bundle exec rake sunspot:solr:stop

auto-complete
-------------
for auto-complete to work, copy from the following config files from the 1418 config directory to the solr config directory.

```
cp config/solr/conf/solrconfig.41.xml solr/conf/solrconfig.xml
cp config/solr/conf/schema.xml solr/conf/schema.xml
```

pre-populate europeana records
------------------------------
1. download the [europeana_records.sql file](https://www.assembla.com/spaces/europeana-1914-1918/documents/a3L0TgGQer445wacwqjQWU/download/a3L0TgGQer445wacwqjQWU)
1. extract the file to a convenient location
1. import the sql into your local 1914-1918 db `mysql -u username -p databasename < path/example.sql`

re-index solr
-------------
bundle exec rake sunspot:solr:start
bundle exec rake sunspot:reindex

configure federated search
---------------------------
In order to retrieve federated search results you need to do the following:
1. cp config/federated_search.yml.example config/federated_search.yml
1. register for the appropriate api keys
1. add them to the development section of config/federated_search.yml

configure application to use solr
---------------------------------
On your installation of 1418, once you have started the server:
1. go to the URL /en/admin/config/edit
1. change the search engine drop-down setting to solr.

solr dashboard
--------------
http://localhost:8982/solr/#/

start the server
================
$ rails server
# or
$ rails s
# or
$ bundle exec thin start


secure the admin account
========================
the admin account is setup with initial credentials shown in the seeds.rb. you should login
to the admin interface and modify those credentials in the My account : Edit sign in details
section


google usage statistics
=======================
add the google api key to the config/ directory
log into the site as an admin
go to the admin configuration page
add the appropriate google analytics key
add the google api email address @developer.gserviceaccount.com

stats are cached for one week
# to clear the cache
```
bundle exec rake cache:google_analytics:clear
```


some ruby extras
================
set rails environment
---------------------
before issuing a set of rake commands or starting rails, make sure the RAILS_ENV
is set to the proper environment: development, test, production. in your dev
environment you usually do not need to enter this command

```
RAILS_ENV=production
```

rake tasks
----------
display all of the rake tasks available

```
bundle exec rake rake-command --tasks
```

add --trace at the end of the command to see potential issues as the command issues

```
bundle exec rake rake-command assets:expire --trace
```


upgrading pdf.js viewer
=======================
1.  make sure you already have node installed
2.  cd to a working directory for building pdf.js
3.  $git clone https://github.com/mozilla/pdf.js.git
4.  $node make generic
5.  $cd /build/generic/web/
6.  $cp -R * /public/themes/common/mozilla/pdf.js/
7.  $cd /build/generic/build/
8.  $cp pdf.js /public/themes/common/mozilla/pdf.js/
9.  alter viewer.js
    comment out or delete the line
    var DEFAULT_URL = 'compressed.tracemonkey-pldi-09.pdf';
    comment out or delete the line
    PDFJS.workerSrc = '../build/pdf.js';
    replace it with
    PDFJS.workerSrc = '/themes/common/mozilla/pdf.js/pdf.js';
10. in the erb file, e.g., /public/themes/v3/views/attachments/_pdf.html.erb,
    make sure you have a line similar to the following before viewer.js loads
    <script>var DEFAULT_URL = '<%= @attachment.file.url(:original) %>';</script>
11. alter viewer.css so that all url() entries point to /themes/common/mozilla/pdf.js/
    this is necessary because on test and in production the css reference is to a
	cached css file that resides outside the pdf.js folder



upgrading mediaelement
======================
1. cd to a working directory for storing mediaelement
2. $git clone https://github.com/johndyer/mediaelement.git
3. $cp /path/to/mediaelement/build/* /path/to/europeana-1914-1918/public/themes/common/mediaelement/
4. delete any text files copied to europena-1914-1918
5. alter mediaelementplayer.css so that all url() entries point to /themes/common/mediaelement/
   this is necessary because on test and in production the css reference is to a
   cached css file that resides outside the pdf.js folder



reset password on localhost
===========================
1. make sure you have the rails console open and available and the app is running
2. go to the sign-in page, http://localhost:3000/en/users/sign-in
3. click on forgot password?
4. enter your account email address
5. click submit
6. in the ruby console you'll find the reset password link you can use


update thumbnails and dimmensions
=================================
# add --trace at the end of the command to see potential issues as the command issues
$bundle exec rake paperclip:refresh:thumbnails CLASS=Attachment
# on test
$RAILS_ENV=production bundle exec rake paperclip:refresh:thumbnails CLASS=Attachment


# On a Mac, a 1-line file in /etc/paths.d will be added to the path.  Imagemagick lives in /opt/local/bin, therefore:

cd /etc/paths.d

sudo nano opt
  /opt/local/bin



#_____________________________
#
#  Project Theme Setup
#_____________________________
#

(1)	copy everything under:
		public/themes/v2
	to:
		public/themes/v_new_theme


(2)	copy everything under:
  		themes/v2
	to:
  		themes/v_new_theme


(3) Text replace "v2" with "v_new_theme" in the following files:

	themes/v3/views/contributions/_search-results.html.erb
	themes/v3/views/layouts/_footer.html.erb
	themes/v3/views/layouts/_header.html.erb
	themes/v3/views/layouts/_links.html.erb
	themes/v3/views/layouts/_scripts.html.erb


(4) NOTE: if you base your theme on v3 rather than v2 then step 3 is not needed.







#_____________________________
#
#  Ruby Use
#_____________________________
#

# use a GemSet

rvm use 1.9.3@andy --create --default

# freeze versions and create a gem configuration file see here:
# http://ruby.railstutorial.org/ruby-on-rails-tutorial-book#top


#_____________________________
#
#  Git Use
#_____________________________
#

# One-off, per machine

git config --global user.name "andyjmaclean"
git config --global user.email andyjmaclean@gmail.com
git config --global alias.co checkout

# cd to root of project and run

git init

# (configure .gitignore ???)

# add and commit (locally)

git add .
git commit -m "Initial commit"

# commit (remote) is done with

git push

# check status

git status

# revert (-f) or checkout

git checkout -f



#_____________________________
#
#  Heroku Use
#_____________________________
#

# login

heroku login


# run from project root

heroku create


# send src

git push heroku master

# Messgae if you forget to call "heroku create"
#   fatal: 'heroku' does not appear to be a git repository
#   fatal: The remote end hung up unexpectedly


# Migrate data

heroku run rake db:migrate

# open browser to view

heroku open




#_____________________________
#
#  Terminal Configuration
#_____________________________
#

# Bash shells read a different profile depending if run locally or ssh-ed into remotely.
#
#
# (menu) Edit | Profile Preferences
# then
# (tab) Title and Command
# check "Run command as a login temrinal"


#_____________________________
#
#  Sphinx Installation
#_____________________________
#

# install

sudo apt-get install sphinxsearch

# configure

# see Dan

# activate (change "START=no" to "START=yes" here)

nano /etc/default/sphinxsearch



#_____________________________
#
#  Eclipse Setup
#_____________________________
#

# (menu) Help | Install New Software...
#
# (select) work with:
#
#   Indigo - http://download.eclipse.org/releases/indigo
#   Indigo - http://download.eclipse.org/releases/juno
#   etc.
#
# Check this:
#   Programming Languages ->     Dynamic Languages Toolkit - Ruby Development Tools
#
# (restart)
#
# (toolbar) Run Configurations...
# (select) Ruby Script
# (button) New Launch Configuration...
# (tab) Interpreter
# (button) Installed Interpreters
# (button) Add
# Add a line like the following, give a name, save and delete redundant configuration

~/.rvm/rubies/ruby-1.9.3-p392/bin/ruby



#_____________________________
#
#  Database Setup
#_____________________________
#