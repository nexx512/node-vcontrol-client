const net = require("net")

module.exports = class MockVControlD {

  constructor(mockVControldData, logger) {
    this.mockVControldData = mockVControldData

    this.logger = logger ? logger : () => {}
    this.server = new net.Server((c) => {
      c.on("end", () => this.logger("client disconnected."))
      this.logger("client connected.")
      c.write("vctrld>")
      c.on("data", async (data) => {
        let rawCommand = data.toString().replace(/\r?\n$/, "")
        this.commandLog.push(rawCommand)
        let args = rawCommand.split(" ")
        let command = args.shift()
        if (command == "quit") {
          c.end()
        } else {
          this.logger("Command:", command)
          if (args.length == 0) {
            let responseFunction = mockVControldData[command]
            if (responseFunction) {
              let response = await responseFunction()
              this.logger("Response:", response)
              try {
                c.write(response + "\n")
              } catch (e) {
                this.logger("Error sending resonse: " + e)
              }
            } else {
              this.logger("Unknown command.")
              c.write("ERR: unknown command\n")
            }
          } else {
            let commandArgsRegexp = new RegExp(await mockVControldData[command]())
            this.logger("Arguments:", args)
            if (args.every((a) => commandArgsRegexp.test(a))) {
              c.write("OK\n")
            } else {
              this.logger("Arguments don't match " + commandArgsRegexp.toString())
              c.write("ERR: invalid arguments. Arguments don't match " + commandArgsRegexp.toString+ "\n")
            }
          }
          try {
            c.write("vctrld>")
          } catch (e) {
            this.logger("Error sending prompt: " + e)
          }
        }
      })
    })
    this.server.on("error", (e) => {throw e})
    this.resetCommandLog()
  }

  resetCommandLog() {
    this.commandLog = []
  }

  async start(host, port) {
    return new Promise((resolve, reject) => {
      this.server.listen(port, host, (e) => {
        e ? reject(e) : resolve()
      })
    })
  }

  async stop() {
    return new Promise((resolve, reject) => {
      this.server.close((e) => {
        e ? reject(e) : resolve()
      })
    })
  }

}
