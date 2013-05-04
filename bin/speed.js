/* Node.js Speed Test - Server 
    Originally made by snoj: https://github.com/snoj/speedtest 
    Modifications by David A. Cohen II
*/

var http = require('http');
var url = require("url");
var fs = require("fs");
var _config = require("./config.json");
var ua_parser = require('ua-parser');

var opts = {
    "url": ["/", "/download", "/upload", "/jquery.js", "/speed.html", "/jquery.ajax-progress.js", "/ip", "/conf", "/speed.js", "/dl_results", "/ul_results", "/modernizr.custom.72111.js", "/geo.js"],
    "limits": _config.limits,
    "port": _config.port || 8080,
    "ip": _config.ip || "0.0.0.0"
};
var file_types = {
    js: "application/javascript",
    html: "text/html"
};
httpd = http.createServer(function(req, res) {
    // console.log(req.headers);
    var r = ua_parser.parse(req.headers['user-agent']);
    console.log("USER AGENT:\t", r.ua.toString());
    console.log("OS:\t\t", r.os.toString());
    console.log("DEVICE:\t\t", r.device.family);
    console.log("ADDRESS:\t", req.connection.remoteAddress);
    var dl_chunks = "";
    var ul_chunks = "";
    var uploadsize = 0;
    switch (opts.url.indexOf(url.parse(req.url.replace("//", "/")).pathname)) {
        case 2:
            //upload

            req.on("data", function(d) {
                uploadsize += d.length;
                if (uploadsize > opts.limits.maxUploadSize) {
                    //Kill it! Kill it with fire!
                    req.connection.destroy();
                }
            });
            break;
        case 9:
            req.on("data", function(d){
                dl_chunks += d;
            });
            break;
        case 10:
            req.on("data",function(d){
                ul_chunks += d;
            });
            break;
    }

    //http://thecodinghumanist.com/blog/archives/2011/5/6/serving-static-files-from-node-js
    req.on('end', function() {
        switch (opts.url.indexOf(url.parse(req.url.replace("//", "/")).pathname)) {
            case 1:
                //download
                var max = parseInt(url.parse(req.url, true).query.size, 10);
                if (typeof(max) == 'undefined' || max > opts.limits.maxDownloadSize || max % 1 !== 0) {
                    res.writeHead(500);
                    res.end("The number " + (typeof(max) == 'undefined' || max > opts.limits.maxDownloadSize || max % 1 !== 0) + ", it's too big or NaN!");
                    break;
                }

                // If valid, create buffer and fill with zeros
                var b = new Buffer(max);
                b.fill(0x0);
                res.writeHead(200, {
                    'Content-length': max
                });
                res.end(b); // fill the response with the buffer
                break;
            case 2:
                res.end();
                break;
            case 9:
                console.log("download_results: " + dl_chunks);
                res.writeHead(200);
                res.end();
                break;
            case 10:
                console.log("upload_results: " + ul_chunks);
                res.writeHead(200);
                res.end();
                break;
            case 0:
            case 3:
            case 4:
            case 5:
            case 11:
            case 12:
            case 8:
                var tfile = url.parse(req.url).pathname;

                //fix for reverse proxy when not using / (that is http://host/somepath/speed.html)
                if (tfile.replace("//", "/") == "/") {
                    tfile = "/speed.html";
                }
                try {
                    stats = fs.lstatSync("./html" + tfile); // throws if path doesn't exist
                } catch (e) {
                    console.log(e);
                    res.writeHead(404, {
                        'Content-Type': 'text/plain'
                    });
                    res.end("404: file not found or more likely, you're trying to go somewhere you can't.");
                    return;
                }
                var s = fs.createReadStream("./html" + tfile);
                res.on("end", function() {
                    s.destroy();
                });
                s.on('error', function(e) {
                    console.log(req.url);
                    console.log(tfile);
                    console.log(e);
                    res.writeHead(404, {
                        'Content-Type': 'text/plain'
                    });
                    res.end("404: file not found or more likely, you're trying to go somewhere you cannot go.");
                });
                s.once('fd', function() {
                    res.statusCode = 400;
                });
                res.writeHead(200, {
                    "Content-type": file_types[tfile.substring(tfile.lastIndexOf(".") + 1)] || "text/plain"
                });
                s.pipe(res);
                break;
            case 6:
                res.end(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.headers["HTTP_X_FORWARDED_FOR"] || req.connection.remoteAddress);
                break;
            case 7:
                res.writeHead(200, {
                    "Content-Type": "application/json"
                });
                res.end(JSON.stringify(opts.limits));
                break;

            default:
                res.writeHead(400);
                res.write("fail");
                res.end();
        }
    });
});
httpd.listen(opts.port, opts.ip);
