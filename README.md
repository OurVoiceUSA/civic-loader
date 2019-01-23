## Introduction

Our Voice USA is a 501(c)(3) non-profit, non-partisian organization for civic education. We are writing tools to engage everyday citizens with the political process by providing easy access to civic information that's relevant to the individual.

## Features

This is where we write scripts to call 3rd party APIs and store the data locally in redis. Data is used by the `civic-broker` server.

## Development Setup

Start by configuring the `.env` file:

    cat << EOF > .env
    export REDIS_HOST=localhost
    export REDIS_PORT=6379
    export USTERM=115
    export ELECTION_YEAR=2018
    export API_KEY_FEC=<YOUR KEY>
    export API_KEY_OPENSTATES=<YOUR KEY>
    export DEBUG=1
    EOF

Then, install dependancies with `npm install`, source in the configuration with `source .env`, and run `npm start`.

* The `API_KEY_FEC` is obtained here: https://api.open.fec.gov/developers/
* The `API_KEY_OPENSTATES` is obtained here: https://openstates.org/api/register/

**NOTE:** At the time of this writing, the tool versions are as follows:

    $ npm -v
    5.6.0
    $ node -v
    v8.11.3

## Contributing

Thank you for your interest in contributing to us! To avoid potential legal headaches please sign our CLA (Contributors License Agreement). We handle this via pull request hooks on GitHub provided by https://cla-assistant.io/

## License

While most of our stuff is GPL, this repostiroy is released under the MIT License so you can use these functions without having to worry about compliance issues. We hope you find utility here.

        MIT License

        Copyright (c) 2018 Our Voice USA

        Permission is hereby granted, free of charge, to any person obtaining a copy
        of this software and associated documentation files (the "Software"), to deal
        in the Software without restriction, including without limitation the rights
        to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
        copies of the Software, and to permit persons to whom the Software is
        furnished to do so, subject to the following conditions:

        The above copyright notice and this permission notice shall be included in all
        copies or substantial portions of the Software.

        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
        AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
        LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
        OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
        SOFTWARE.

