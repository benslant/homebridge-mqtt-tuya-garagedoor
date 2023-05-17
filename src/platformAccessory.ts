import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { Characteristic } from 'hap-nodejs';
import { TuyaMqttGarageDoorPlatform } from './platform';
import { Z2MMqttClient } from './mqtt_client';
import { TuyaGarageDoorStateMachine } from './statemachine'


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class TuyaMqttGarageDoorAccessory {
  private service: Service;
  private client: Z2MMqttClient;
  private statemachine: TuyaGarageDoorStateMachine;
  private currentState = {
    status: 'initialize'
  }

  private state = {
    targetDoorState: Characteristic.TargetDoorState.CLOSED,
    currentDoorState: Characteristic.CurrentDoorState.CLOSED,
  };

  constructor(private readonly platform: TuyaMqttGarageDoorPlatform,
              private readonly accessory: PlatformAccessory,
              private readonly mqqt_client: Z2MMqttClient) 
  {
    this.statemachine = new TuyaGarageDoorStateMachine(this, this.platform.log)
    this.currentState = this.statemachine.getInitialState()
    this.client = mqqt_client
    this.client.on('garage_door_contact', (open) => {
      this.handle_mqtt_update_current_door_state(open)}
      )
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.GarageDoorOpener) || this.accessory.addService(this.platform.Service.GarageDoorOpener);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName);

    this.service.getCharacteristic(this.platform.Characteristic.TargetDoorState)
      .onSet(this.setTargetDoorState.bind(this))
      .onGet(this.getTargetDoorState.bind(this))

    this.service.getCharacteristic(this.platform.Characteristic.CurrentDoorState)
      .onGet(this.getCurrentDoorState.bind(this))
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setTargetDoorState(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    this.state.targetDoorState = value as number
    this.platform.log.debug('Set Door Target state ->', this.state.targetDoorState);
    let event = 'DOOR_CLOSING'
    if(this.state.targetDoorState == Characteristic.TargetDoorState.OPEN) event = 'DOOR_OPENING'
    this.processDoorState(event)
  }

  processDoorState(event_name: String)
  {
    this.platform.log.debug('Processing door state..')
    let event = { type: event_name}
    this.currentState = this.statemachine.transition(this.currentState, event)
  }

  testEnter()
  {
    this.platform.log.debug('test');
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getCurrentDoorState(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    const currentDoorState = this.state.currentDoorState;
    this.platform.log.debug('Get Door Current State ->', currentDoorState);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    return currentDoorState;
  }

  handle_mqtt_update_current_door_state(closed: boolean)
  {
    if(closed)
    {
      this.processDoorState('DOOR_CLOSED_DETECTED')
      this.state.currentDoorState = Characteristic.CurrentDoorState.CLOSED
      this.service.updateCharacteristic(Characteristic.CurrentDoorState, 
                                        Characteristic.CurrentDoorState.CLOSED)
    } else
    {
      this.processDoorState('DOOR_OPEN_DETECTED')
      this.state.currentDoorState = Characteristic.CurrentDoorState.OPEN
      this.service.updateCharacteristic(Characteristic.CurrentDoorState,
                                        Characteristic.CurrentDoorState.OPEN)
    }
    let state_text = 'closed'
    if(!closed) state_text = 'open'
      
    this.platform.log.debug('Received door state -> ', state_text)
  }

    /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
    async getTargetDoorState(): Promise<CharacteristicValue> {
      // implement your own code to check if the device is on
  
      this.platform.log.debug('Get Target Door State ->', this.state.targetDoorState);
  
      // if you need to return an error to show the device as "Not Responding" in the Home app:
      // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      return this.state.targetDoorState;
    }

    /// Wait for the door to close. Triggers an event 
    ///
    startTimerForDoorClose()
    {
      setTimeout(this.handleDoorCloseTimeout, 1500);
    }

    handleDoorCloseTimeout()
    {
      this.processDoorState('DOOR_CLOSE_TIMEOUT')
    }

    stopTimerForDoorClose()
    {

    }
}