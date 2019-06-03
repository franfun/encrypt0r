const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const { inherits } = require('util');

const Vector = require('./vector');

function calculateProgress(chunkSize, totalSize) {
  return Math.floor((chunkSize / totalSize) * 100);
}

class Utils {
  constructor(originalFile, destinationFile, password) {
    EventEmitter.call(this);
    this.originalFile = originalFile;
    this.destinationFile = destinationFile;
    this.password = password;
  }

  getCipherKey() {
    return crypto.createHash('sha256').update(this.password).digest();
  }

  encrypt() {
    const that = this;
    const initVector = crypto.randomBytes(16);
    const cipherKey = this.getCipherKey();
    const readStream = fs.createReadStream(this.originalFile);
    const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, initVector);
    const initVectorStream = new Vector(initVector);
    const writeStream = fs.createWriteStream(path.join(this.destinationFile));
    let size = 0;
    const stat = fs.statSync(this.originalFile);
    readStream
      .pipe(cipher)
      .pipe(initVectorStream)
      .pipe(writeStream);
    size = 0;

    readStream.on('data', (chunk) => {
      size += chunk.length;
      that.emit('progress', calculateProgress(size, stat.size));
    });
    writeStream.on('finish', () => {
      that.emit('finished');
    });
  }

  decrypt() {
    const that = this;
    let initVector;
    let size = 0;
    const initVectorStream = fs.createReadStream(this.originalFile, { end: 15 });
    let cipherKey; let
      decipher;
    let readStream; let
      writeStream;
    initVectorStream.on('data', (chunk) => {
      initVector = chunk;
    });
    initVectorStream.on('close', () => {
      cipherKey = this.getCipherKey();
      decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, initVector);
      readStream = fs.createReadStream(this.originalFile, { start: 16 });
      writeStream = fs.createWriteStream(path.join(this.destinationFile));
      readStream
        .pipe(decipher)
        .pipe(writeStream);
    });
    initVectorStream.on('close', () => {
      size = 0;
      const stat = fs.statSync(this.originalFile);
      readStream.on('data', (chunk) => {
        size += chunk.length;
        that.emit('progress', calculateProgress(size, stat.size));
      });
      writeStream.on('finish', () => {
        that.emit('finished');
      });
    });
  }
}

inherits(Utils, EventEmitter);

module.exports = Utils;
