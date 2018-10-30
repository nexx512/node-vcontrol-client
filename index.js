const net = require("net")

class VControlClient {

  /**
   * Create a new instance for a VControl client
   */
  constructor() {
    this.client = new net.Socket()

    this.resetHandlers()

    this.client.on("data", (data) => this.dataHandler(data.toString()))
    this.client.on("error", (error) => this.errorHandler(error))
    this.client.on("close", () => this.closeHandler())
  }

   /**
    * Reset all internal handlers
    *
    * @api private
    */
  resetHandlers() {
    this.closeHandler = () => {}
    this.errorHandler = () => {}
    this.dataHandler = () => {}
  }

  /**
   * Connect to a vcontrold service and wait for the connection.
   * Rejects if the connectino can't be established or the server doesn't
   * respond with a valid prompt.
   *
   * @param {String} host
   * @param {Number} port
   * @return {Promise}
   */
  async connect(host, port) {
    return new Promise((resolve, reject) => {
      this.errorHandler = reject
      this.dataHandler = (data) => {
        if (data === "vctrld>") {
          console.log("Connection to vControl established")
          resolve()
        } else {
          reject(new Error(data))
        }
      }
      console.log("Connecting to vControl...")
      this.client.connect(port, host)
    }).then(() => {
      this.resetHandlers()
    })
  }

  /**
   * Close the connection to the server by sending the `quit` command.
   *
   * @return {Promise}
   */
  async close() {
    return new Promise((resolve, reject) => {
      this.errorHandler = reject
      this.closeHandler = () => {
        console.log("Connection to vControl closed")
        resolve();
      }
      this.client.write("quit\n")
    }).then(() => {
      this.resetHandlers()
    })
  }

  /**
   * Read data from the heating system by calling a `get` command.
   *
   * @param {String} command
   * @return {Promise} The Promise contains the data returned by the command. Rejected if the command can not be executed.
   */
  async getData(command) {
    return new Promise((resolve, reject) => {
      let response
      this.errorHandler = reject
      this.dataHandler = (data) => {
        let dataMatches = data.match(/([\s\S]*?)(vctrld>)?$/)
        if (dataMatches && dataMatches[1]) {
          response = dataMatches[1]
        }
        if (dataMatches && dataMatches[2]) {
          console.log("Command finished.")
          if (response.startsWith("ERR:")) {
            return reject(new Error("Unable to perform command '" + command + "': " + response))
          } else {
            console.log("Received response: " + response)
            return resolve(response)
          }
        }
      }
      console.log("Sending command: '" + command + "'...")
      this.client.write(command + "\n")
    }).then((data) => {
      this.errorHandler = () => {}
      this.dataHandler = () => {}
      return data
    })
  }

  /**
   * Write data to the heating system by calling a `set` command.
   *
   * @param {String} command
   * @param {String|String[]} args Arguments for the set command
   * @return {Promise} Rejected if the command fails
   */
  async setData(command, args) {
    return new Promise((resolve, reject) => {
      let response
      let commandString
      this.errorHandler = reject
      this.dataHandler = (data) => {
        let dataMatches = data.match(/([\s\S]*?)(vctrld>)?$/)
        if (dataMatches && dataMatches[1]) {
          response = dataMatches[1]
        }
        if (dataMatches && dataMatches[2]) {
          console.log("Command finished.")
          if (response.startsWith("OK")) {
            return resolve(response)
          } else {
            return reject(new Error("Command for vcontrold failed: " + commandString + " (" + response + ")"))
          }
        }
      }
      console.log("Sending command: '" + command + "'...")

      let argsString = ""
      if (args instanceof Array) {
        argsString = args.filter((d) => d).join(" ")
      } else if (args) {
        argsString = args
      }
      commandString = command + " " + argsString
      this.client.write(commandString + "\n")
    }).then((data) => {
      this.errorHandler = () => {}
      this.dataHandler = () => {}
      return data
    })
  }

}

module.exports = VControlClient