/**
 * KINOID
 *
 * @overview
 * Kinoid is a lightweight function for generating unique, URL-friendly IDs.
 * It is designed to work in both Node.js and browser environments.
 *
 * @description
 * Kinoid generates unique identifiers (IDs) that are:
 * - **Unique**: Each ID is guaranteed to be different from all others
 *   generated before or at the same time on the same machine.
 * - **Sortable by time**: IDs are based on the timestamp of their creation,
 *   making them naturally sortable.
 * - **Decodable**: The `decodeId()` function allows you to extract the
 *   components used to generate an ID, such as the timestamp, process ID,
 *   and singularity factor.
 *
 * ### How IDs are generated
 * Each ID is composed of:
 * - A **timestamp**: The number of milliseconds since the UNIX epoch.
 * - A **process ID**: Identifies the process in which the program runs.
 * - A **singularity factor**: A sequential number that ensures uniqueness
 *   even when multiple IDs are generated in the same millisecond.
 *
 * ### Main Functions
 * - `newId()`: Generates a new unique ID as a string.
 * - `decodeId()`: Decodes an existing ID into its components, such as the
 *   timestamp, singularity factor, and process ID.
 *
 * ### Warning
 * Kinoid ensures that each generated ID is **unique**, but not necessarily
 * **unpredictable**. If you need cryptographically secure IDs, consider
 * using a library designed for that purpose.
 *
 * @author Thorn Duke
 * @version 3
 * @license MIT
 * @copyright Thorn Duke 2024
 */

/**
 * Function for the generation and decoding of unique identifiers.
 *
 * @returns {{ newId: function, decodeId: function }}
 *
 * @example
 * // Import the library
 * const { newId, decodeId } = kinoid();
 *
 * // Generate a new ID
 * const id = newId();
 * console.log(id); // Example: 'cohb4z87mvoyf1zjy'
 *
 * // Decode the ID
 * const decoded = decodeId(id);
 * console.log(decoded);
 * // Output:
 * // {
 * //   id: 'cohb4z87mvoyf1zjy',
 * //   date: 2024-11-19T16:52:19.962Z,
 * //   singularity: 1144,
 * //   pid: 5438
 * // }
 *
 * // Handle invalid IDs
 * const invalidId = 'invalid123';
 * const result = decodeId(invalidId);
 * console.log(result);
 * // Output:
 * // { id: 'invalid123', error: 'Invalid ID format: invalid123' }
 */
export function kinoid() {
  /**
   * Regular expression defining the format of a valid ID.
   * A valid ID is a 17-character string composed of lowercase letters and numbers.
   *
   * @constant
   * @type {RegExp}
   */
  const idRe = new RegExp("^[a-z0-9]{17}$");

  let currTimeStamp = 0;
  let prevTimeStamp = 0;
  let singularity = 0;
  let pid = 0;

  /**
   * The starting time for generating timestamps, set to a fixed epoch.
   * This ensures that all generated IDs are based on a consistent reference point.
   *
   * @constant
   * @type {number}
   */
  const startTime = 1640434800000; // 2021-12-25T12:20:00.000Z

  /**
   * A prefix added to the ID to prevent accidental misinterpretation of the
   * structure of the IDs when they starts with a zero.
   *
   * @constant
   * @type {string}
   */
  const slipPreventer = "1";

  /**
   * The length of the timestamp portion of the ID.
   *
   * @constant
   * @type {number}
   */
  const timeStampLength = 13;

  /**
   * The length of the singularity portion of the ID.
   * This ensures that IDs generated within the same millisecond remain unique.
   *
   * @constant
   * @type {number}
   */
  const singularityLength = 6;

  /**
   * The maximum length of the process ID portion of the ID.
   *
   * @constant
   * @type {number}
   */
  const pidLength = 7;

  /**
   * Error message displayed when a critical limit is reached, preventing further ID generation.
   *
   * @constant
   * @type {string}
   */
  const errMsg =
    "A critical technical limit has been reached. Kinoid is unable to generate unique IDs. Please ask the system administrator for a library update.";

  try {
    const anyProcess = typeof process !== "undefined" ? process : undefined;
    if (anyProcess && (anyProcess as any).pid) {
      pid = (anyProcess as any).pid;
      if (pid.toString.length > pidLength) {
        throw new RangeError(errMsg, { cause: "pid is out of range" });
      }
    }
  } catch (error: any) {
    logError(error);
    throw error;
  }

  /**
   * Logs error messages to the console in a standardized format.
   *
   * @param {Error} error - The error object to log.
   */
  function logError(error: Error) {
    console.error(`[Kinoid Error] ${error.name}: ${error.message} [${error.cause}]`);
  }

  /**
   * Pads a number or string with leading zeroes to ensure it reaches a specified length.
   *
   * @param {number|string} val - The value to pad.
   * @param {number} length - The desired length of the resulting string.
   * @returns {string} A string of the specified length with leading zeroes.
   *
   * @example
   * zeroPadded(42, 5); // "00042"
   */
  function zeroPadded(val: number, length: number) {
    return val.toString().padStart(length, "0");
  }

  /**
   * Checks if a given string matches the structure of a valid ID.
   *
   * @param {string} id - The ID to validate.
   * @returns {boolean} `true` if the ID is valid, `false` otherwise.
   *
   * @example
   * hasIdStructure('cohb4z87mvoyf1zjy'); // true
   * hasIdStructure('invalid123'); // false
   */
  function hasIdStructure(id: string) {
    return idRe.test(id);
  }

  /**
   * Converts a base36 string to a BigInt.
   *
   * @param {string} bigintVal - The base36 string to convert.
   * @returns {BigInt} The equivalent BigInt value.
   *
   * @example
   * int36ToBigInt('1z'); // 71n
   */
  function int36ToBigInt(bigintVal: { toString: () => string }) {
    return (
      bigintVal
        .toString()
        .split("")
        // @ts-expect-error lib issues
        .reduce((result: number, char: string) => {
          // @ts-expect-error lib issues
          return (result * BigInt(36) + BigInt(parseInt(char, 36)), BigInt(0));
        })
    );
  }

  /**
   * Updates the internal properties used for generating IDs.
   * This function calculates the current timestamp and ensures the singularity factor
   * is incremented or reset as needed.
   *
   * @throws {RangeError} If the timestamp or singularity exceeds their respective limits.
   */
  function updateProperties() {
    try {
      currTimeStamp = Date.now() - startTime;
      if (currTimeStamp == prevTimeStamp) {
        singularity++;
      } else {
        singularity = 0;
        prevTimeStamp = currTimeStamp;
      }

      if (currTimeStamp.toString.length > timeStampLength) {
        throw new RangeError(errMsg, { cause: "timeStamp is out of range" });
      }

      if (singularity.toString.length > singularityLength) {
        throw new RangeError(errMsg, { cause: "singularity is out of range" });
      }
    } catch (error: any) {
      logError(error);
      throw error;
    }
  }

  const publicAPI = {
    /**
     * Generates a new unique ID.
     * The ID is composed of a timestamp, a singularity factor, and a process ID.
     *
     * @returns {string} The generated unique ID.
     *
     * @example
     * const id = newId();
     * console.log(id); // Example: 'cohb4z87mvoyf1zjy'
     */
    newId: function () {
      updateProperties();

      const paddedSingularity = zeroPadded(singularity, singularityLength);
      const paddedTimeStamp = zeroPadded(currTimeStamp, timeStampLength);
      const paddedPid = zeroPadded(pid, pidLength);
      const idMask = `${slipPreventer}${paddedTimeStamp}${paddedSingularity}${paddedPid}`;

      return BigInt(idMask).toString(36);
    },

    /**
     * Decodes a given ID into its components.
     *
     * @param {string} id - The ID to decode.
     * @returns {{
     *   id: string,
     *   date: Date,
     *   singularity: number,
     *   pid: number
     * } | {
     *   id: string,
     *   error: string
     * }} An object containing the decoded components or an error message.
     *
     * @example
     * const decoded = decodeId('cohb4z87mvoyf1zjy');
     * console.log(decoded);
     * // {
     * //   id: 'cohb4z87mvoyf1zjy',
     * //   date: 2024-11-19T16:52:19.962Z,
     * //   singularity: 1144,
     * //   pid: 5438
     * // }
     */
    decodeId: function (id: any) {
      if (!hasIdStructure(id)) {
        return {
          id,
          error: `Invalid ID format: ${id}`,
        };
      }

      const decIdStr = int36ToBigInt(id).toString().substring(slipPreventer.length);
      const dateStart = 0;
      const dateEnd = dateStart + timeStampLength;
      const singularityStart = dateStart + timeStampLength;
      const singularityEnd = dateStart + timeStampLength + singularityLength;
      const pidStart = dateStart + timeStampLength + singularityLength;

      const idDate = new Date(Number(decIdStr.slice(dateStart, dateEnd)) + startTime);
      const idSingularity = Number(decIdStr.slice(singularityStart, singularityEnd));
      const idPid = Number(decIdStr.slice(pidStart));

      const errMsg =
        idDate.valueOf() < startTime
          ? "date is out of range"
          : idSingularity < 0
            ? "singularity is out of range"
            : idPid < 0
              ? "PID is out of range"
              : "undefined error";

      const isValidId = idDate.valueOf() >= startTime && idSingularity >= 0 && idPid >= 0;

      if (!isValidId) {
        return {
          id,
          error: `the string ${id} is not a valid ID: ${errMsg}`,
        };
      }

      return {
        id,
        date: idDate,
        singularity: idSingularity,
        pid: idPid,
      };
    },
  };

  return publicAPI;
}
