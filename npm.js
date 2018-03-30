module.exports = function(RED) {
  "use strict";
  const { getInstalledPathSync } = require('get-installed-path')

  var npm = require(getInstalledPathSync('npm'));
  var fs = require("fs-extra");
  var { spawn } = require('child_process');

  function npmNode(n) {
    RED.nodes.createNode(this,n);
    this.nodename = n.nodename;
    this.method = n.method;
    this.path = n.path;
    var node = this;

    this.on("input", function(msg) {
      node.status({fill:"blue",shape:"dot"});
      node.send(msg);

      if(msg.method !== undefined && msg.method !== "") node.method = msg.method;
      if(msg.path !== undefined && msg.path !== "") node.path = msg.path;

      if(msg.nodename !== undefined && msg.nodename !== ""){
        node.nodename = msg.nodename;
      } else if(msg.value !== undefined && msg.value !== ""){
        node.nodename = msg.value;
      } else if(msg.payload !== undefined && msg.payload !== ""){
        node.nodename = msg.payload;
      }

      if (node.method === "install"){
        npm.load({ prefix: node.path, "unsafe-perm":true },function (err) {
          var filename = node.path + "/node_modules/" + node.nodename + "/package.json";
          var tail = spawn("tail", ["-F", "-n", "0", filename]);
          tail.stdout.on("data", function (taildata) {
            try{
              taildata = JSON.parse(taildata);
            } catch(e){}
            var progressbarTime = 60;
            if(taildata.hasOwnProperty("installation-duration")){
              progressbarTime = taildata["installation-duration"];
            }
            tail.kill();
            RED.comms.publish("npmInstall",{progressbarTime:progressbarTime});
          });
          tail.stderr.on("data", function(taildata) {
            setTimeout(function(){if(tail){tail.kill();}}, 10000);
          });
          npm.commands.install([node.nodename], function (er, data) {
            if (er && data === undefined){
              RED.comms.publish("npmInstall",{status:"error"});
              node.status({fill:"red",shape:"dot"});
            } else if (data !== undefined) {
              RED.comms.publish("npmInstall",{status:"success"});
              node.status({});
            }
          });
        });
      } else if (node.method === "uninstall") {
        npm.load({ prefix: node.path },function (err) {
          npm.commands.uninstall([node.nodename], function (er, data) {
            if (er && data === undefined){
              RED.comms.publish("npmUninstall",{status:"error"});
              node.status({fill:"red",shape:"dot"});
            } else if (data !== undefined) {
              RED.comms.publish("npmUninstall",{status:"success"});
              node.status({});
            }
          });
        });
      }
    });
  }
  RED.nodes.registerType("npm",npmNode);
}
