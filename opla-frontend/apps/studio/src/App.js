"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var ui_1 = require("@opla/ui");
require("./App.css");
function App() {
    var _a = (0, react_1.useState)(0), count = _a[0], setCount = _a[1];
    return (<div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-primary mb-4">
            Project Opla
          </h1>
          <p className="text-muted-foreground text-lg">
            Studio Environment
          </p>
        </div>

        <ui_1.OplaCard title="Shared Component Demo">
          <div className="space-y-4">
            <p className="text-foreground">
              This card and button are shared from <code>packages/ui</code>.
            </p>
            <div className="flex justify-center">
              <ui_1.OplaButton title={"Count is ".concat(count)} onPress={function () { return setCount(function (count) { return count + 1; }); }}/>
            </div>
          </div>
        </ui_1.OplaCard>
      </div>
    </div>);
}
exports.default = App;
