# Soteria

A WebDAV based personal cloud security camera system.

# Structure

Soteria (named after the [Greek goddess of safety](<https://en.wikipedia.org/wiki/Soteria_(mythology)>)) is a security camera system, and it is made of three different parts.

## Mnemosyne

Mnemosyne (named after the [Greek goddess of memory](https://en.wikipedia.org/wiki/Mnemosyne)) is a daemon that takes a feed from a webcam or other video device (or virtual device) and uploads it in chunks to a WebDAV server.

## Lethe

Lethe (named after the [river of forgetfulness in Greek mythology](https://en.wikipedia.org/wiki/Lethe)) is a daemon that purges old footage from the WebDAV server according to a schedule and/or quota.

## Theia

Theia (named after the [Greek goddess of sight and vision](https://en.wikipedia.org/wiki/Theia)) is a web app that lets you watch footage from a WebDAV server that has been uploaded by Mnemosyne.

# WebDAV Server

It is highly recommended to use [Nephele WebDAV Server](https://github.com/sciactive/nephele), as that is what Soteria is tested with. However, it should work with any WebDAV server. If you run into any issues running it with a different WebDAV server, feel free to file a bug in this repo. If it turns out to be a bug with that WebDAV server instead, we can help direct you to the right place.

Nephele can be run on the same system as Mnemosyne using an S3 compatible cloud storage solution, and even encrypt the video _before_ it is sent to the server. This allows you to create an end-to-end encrypted cloud security camera solution that **only you** have access to. Most of your security camera footage is of you and your family. Don't let big companies or hackers spy on you.

# License

Copyright 2024 SciActive Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
