const net = require("net")

module.exports = class VControl {

  /**
   * Create a new instance for a VControl client.
   *
   * @param {String} host hostname where vcontrold runs
   * @param {Number} port to connect to vcontrold
   */
  constructor(config) {
    this.host = config.host
    this.port = config.port

    if (config.debug) {
      this.logger = console.log
    } else {
      this.logger = () => {}
    }

    this.socket = new net.Socket()

    this.resetHandlers()

    this.socket.on("data", (data) => this.dataHandler(data.toString()))
    this.socket.on("error", (error) => this.errorHandler(error))
    this.socket.on("close", () => this.closeHandler())
  }

  /**
   * Log function
   *
   * @api private
   */
  log(msg) {
    this.logger("[" + this.socket.localPort + "] " + msg)
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
   * @return {Promise}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      if (this.socket.connecting || this.socket.localPort) {
        reject(new Error("Client already connected. Close connection first."))
        return
      }

      this.errorHandler = reject
      this.dataHandler = (data) => {
        if (data === "vctrld>") {
          this.log("Connection to vControl successfully established")
          resolve()
        } else {
          reject(new Error(data))
        }
      }
      this.log("Connecting to vControl...")
      this.socket.connect(this.port, this.host, () => this.log("Connected to vControl server"))
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
        this.log("Connection to vControl closed")
        resolve();
      }
      this.log("Closing connection to vControl...")
      this.socket.end()
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
          this.log("Command finished.")
          if (response.startsWith("ERR:")) {
            return reject(new Error("Unable to perform command '" + command + "': " + response))
          } else {
            this.log("Received response: " + response)
            return resolve(response)
          }
        }
      }
      this.log("Sending command: '" + command + "'...")
      this.socket.write(command + "\n")
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
          this.log("Command finished.")
          if (response.startsWith("OK")) {
            return resolve(response)
          } else {
            return reject(new Error("Command for vcontrold failed: " + commandString + " (" + response + ")"))
          }
        }
      }
      this.log("Sending command: '" + command + "'...")

      let argsString = ""
      if (args instanceof Array) {
        argsString = args.filter((d) => d).join(" ")
      } else if (args) {
        argsString = args
      }
      commandString = command + " " + argsString
      this.socket.write(commandString + "\n")
    }).then((data) => {
      this.errorHandler = () => {}
      this.dataHandler = () => {}
      return data
    })
  }

}
