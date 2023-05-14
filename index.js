'use strict';

const mqtt = require('mqtt');

var Service, Characteristic;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-mqtt-tuya-garagedoor', 'TuyaGarageDoor', TuyaGarageDoor);
};

class TuyaGarageDoor {
  constructor (log, config) {

    //get config values
    // this.name = config['name'];
    // this.doorSwitchPin = config['doorSwitchPin'] || 12;
    // this.simulateTimeOpening = config['simulateTimeOpening'] || 15;
    // this.simulateTimeOpen = config['simulateTimeOpen'] || 30;
    // this.simulateTimeClosing = config['simulateTimeClosing'] || 15;

    //initial setup
    this.log = log;
    this.lastOpened = new Date();
    this.service = new Service.GarageDoorOpener(this.name, this.name);
    this.setupGarageDoorOpenerService(this.service);

    this.log.debug("trying to log something")
    const client = mqtt.connect(config.mqtt.server)
    client.on('connect', function () {
        log('mqtt connected');
    });
    this.client = client;

    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Simple Garage Door')
      .setCharacteristic(Characteristic.Model, 'A Remote Control')
      .setCharacteristic(Characteristic.SerialNumber, '0711');
  }

  getServices () {
    return [this.informationService, this.service];
  }

  congifure_mqtt_topics(name, serviceConfig) {
    const client = this.client;
    const log = this.log;

    client.on('message', this.processMessage.bind(this, 'action', ['zigbee2mqtt/Garage Door']));
    client.on('message', this.processMessage.bind(this, 'garage_door_contact', ['zigbee2mqtt/Garage Door']));
    char.on('set', this.publishTopic.bind(this, 'action', ['zigbee2mqtt/Garage Door']));
    char.on('set', this.publishTopic.bind(this, 'garage_door_contact', ['zigbee2mqtt/Garage Door']));

    // const service = new Service[serviceConfig.type](name);
    // const allCharNames = Array.from(new Set(Object.keys(serviceConfig.props || {}).concat(Object.keys(serviceConfig.topics || {}))));
    // allCharNames.forEach(charName => {
    //     const char = service.getCharacteristic(Characteristic[charName])
    //     if (serviceConfig.props && charName in serviceConfig.props) {
    //         char.setProps(serviceConfig.props[charName]);
    //     }
    //     if (serviceConfig.topics && charName in serviceConfig.topics) {
    //         const topicDefines = serviceConfig.topics[charName];
    //         this.subscribeTopics(char, topicDefines);
    //         client.on('message', this.processMessage.bind(this, char, topicDefines));
    //         char.on('set', this.publishTopic.bind(this, char, topicDefines));
    //     }
    // });
    return service;
  }

  setupGarageDoorOpenerService (service) {
    this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
    this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);

    service.getCharacteristic(Characteristic.TargetDoorState)
      .on('get', (callback) => {
        var targetDoorState = service.getCharacteristic(Characteristic.TargetDoorState).value;
        if (targetDoorState === Characteristic.TargetDoorState.OPEN && ((new Date() - this.lastOpened) >= (this.closeAfter * 1000))) {
          this.log('Setting TargetDoorState -> CLOSED');
          callback(null, Characteristic.TargetDoorState.CLOSED);
        } else {
          callback(null, targetDoorState);
        }
      })
      .on('set', (value, callback) => {
        if (value === Characteristic.TargetDoorState.OPEN) {
          this.lastOpened = new Date();
          switch (service.getCharacteristic(Characteristic.CurrentDoorState).value) {
            case Characteristic.CurrentDoorState.CLOSED:
            case Characteristic.CurrentDoorState.CLOSING:
            case Characteristic.CurrentDoorState.OPEN:
              this.openGarageDoor(callback);
              break;
            default:
              callback();
          }
        } else {
          callback();
        }
      });
  }

  triggerGarageDoor(callback) {
    //mqtt messages here
    this.triggerGarageDoor()
    this.log('Triggering the garage door for...');
    this.simulateGarageDoorOpening();
    callback();
  }

  simulateGarageDoorOpening () {
    this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING);
    setTimeout(() => {
      this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
      setTimeout(() => {
        this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSING);
        this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
        setTimeout(() => {
          this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
        }, this.simulateTimeClosing * 1000);
      }, this.simulateTimeOpen * 1000);
    }, this.simulateTimeOpening * 1000);
  }

  publishTopic(char, topicDefines, state, callback) {
    const client = this.client;
    const log = this.log;

    client.publish(topicDefines.set, JSON.stringify({
        value: state,
    }));
    log(char.displayName + ' set to ' + state);
    callback(null);
  }

  processMessage(char, topicDefines, topic, message) {
    const log = this.log;
    const payload = JSON.parse(message);

    if (topicDefines.get == topic) {
        char.updateValue(payload.value);
        log(char.displayName + ' value updated to ' + payload.value);
    }
    Object.keys(topicDefines.props || {}).forEach(propKey => {
        if (topicDefines.props[propKey] == topic) {
            char.setProps({
                [propKey]: payload.value,
            });
            log(char.displayName + ' ' + propKey + ' updated to ' + payload.value);
        }
    });
}

subscribeTopics(char, topicDefines) {
    const client = this.client;
    const log = this.log;

    client.subscribe(topicDefines.get, (err) => {
        if (!err) {
            log(topicDefines.get + ' subscribed');
        }
    });
    Object.keys(topicDefines.props || []).forEach(propKey => {
        client.subscribe(topicDefines.props[propKey], (err) => {
            if (!err) {
                log(topicDefines.props[propKey] + ' subscribed');
            }
        });
    });
}
}
