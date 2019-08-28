//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.
//
// Microsoft Bot Framework: http://botframework.com
//
// Bot Framework Emulator Github:
// https://github.com/Microsoft/BotFramwork-Emulator
//
// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License:
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED ""AS IS"", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
import { SettingsImpl } from '@bfemulator/app-shared';
import { combineReducers, createStore } from 'redux';

import { bot } from './state/reducers/bot';
import { Emulator } from './emulator';
import { NgrokService } from './ngrokService';
import { setFrameworkSettings } from './state/actions/frameworkSettingsActions';
import { azureAuthSettings, framework, savedBotUrls, windowState, users } from './state/reducers';
import { store } from './state/store';

const mockEmulator = {
  framework: {
    serverUrl: 'http://localhost:3000',
    locale: 'en-us',
    bypassNgrokLocalhost: true,
    serverPort: 8080,
    ngrokPath: '/usr/bin/ngrok',
    server: {
      botEmulator: {
        facilities: {
          conversations: {
            getConversationIds: () => ['12', '123'],
          },
          endpoints: {
            reset: () => null,
            push: () => null,
          },
        },
      },
    },
  },
};
jest.mock('./emulator', () => ({
  Emulator: {
    getInstance: () => mockEmulator,
  },
}));

let mockSettingsStore;
const mockCreateStore = () =>
  createStore(
    combineReducers({
      azure: azureAuthSettings,
      framework,
      savedBotUrls,
      windowState,
      users,
    })
  );
const mockSettingsImpl = SettingsImpl;
jest.mock('./state/store', () => ({
  get store() {
    return mockSettingsStore || (mockSettingsStore = mockCreateStore());
  },
  getSettings: function() {
    return new mockSettingsImpl(mockSettingsStore.getState());
  },
  get dispatch() {
    return mockSettingsStore.dispatch;
  },
}));

const mockCallsToLog = [];
jest.mock('./main', () => ({
  emulatorApplication: {
    mainWindow: {
      logService: {
        logToChat: (...args: any[]) => {
          mockCallsToLog.push({ name: 'remoteCall', args });
        },
      },
    },
  },
}));

const mockRunning = jest.fn(() => false);
const mockConnect = jest
  .fn()
  .mockResolvedValue({ url: 'http://fdsfds.ngrok.io', inspectUrl: 'http://fdsfds.ngrok.io' });
jest.mock('./ngrok', () => {
  return {
    NgrokInstance: jest.fn().mockImplementation(() => {
      return {
        running: () => mockRunning(),
        connect: mockConnect,
        kill: () => true,
      };
    }),
  };
});

describe('The ngrokService', () => {
  const ngrokService = new NgrokService();

  beforeEach(() => {
    store.dispatch(setFrameworkSettings(Emulator.getInstance().framework as any));
    mockCallsToLog.length = 0;
    mockRunning.mockClear();
    mockConnect.mockClear();
  });

  it('should be a singleton', () => {
    expect(ngrokService).toBe(new NgrokService());
  });

  it('should not invoke ngrok for localhost urls', async () => {
    const serviceUrl = await ngrokService.getServiceUrl('http://localhost:3030/v3/messages');
    expect(serviceUrl).toBe('http://localhost:8080');
  });

  it('should connect to ngrok when a remote endpoint is used', async () => {
    const serviceUrl = await ngrokService.getServiceUrl('http://myBot.someorg:3030/v3/messages');
    expect(serviceUrl).toBe('http://fdsfds.ngrok.io');
  });

  it('should broadcast to each conversation that ngrok has reconnected', async () => {
    await ngrokService.getServiceUrl('http://myBot.someorg:3030/v3/messages');
    ngrokService.broadcastNgrokReconnected();
    expect(mockCallsToLog.length).toBe(8);
  });

  it('should report its status to the specified conversation when "report()" is called', async () => {
    await ngrokService.getServiceUrl('http://myBot.someorg:3030/v3/messages');
    await ngrokService.report('12', '');
    expect(mockCallsToLog.length).toBe(1);
  });

  it('should reportNotConfigured() when no ngrokPath is specified', async () => {
    (ngrokService as any).ngrokPath = '';
    await ngrokService.report('12', '');
    expect(mockCallsToLog.length).toBe(3);
    expect(mockCallsToLog[0].args[1].payload.text).toBe(
      'ngrok not configured (only needed when connecting to remotely hosted bots)'
    );
  });

  it('should use the current ngrok instance for an oauth postback url if already running', async () => {
    (ngrokService as any).serviceUrl = 'someServiceUrl';
    (ngrokService as any).pendingRecycle = new Promise(resolve => resolve());
    mockRunning.mockReturnValueOnce(true);
    const serviceUrl = await ngrokService.getServiceUrlForOAuth();

    expect(serviceUrl).toBe('someServiceUrl');

    (ngrokService as any).serviceUrl = undefined;
    (ngrokService as any).pendingRecycle = null;
  });

  it('should start up a new ngrok process for an oauth postback url', async () => {
    mockRunning.mockReturnValueOnce(false);
    mockConnect.mockResolvedValueOnce({ url: 'someNgrokServiceUrl' });
    const serviceUrl = await ngrokService.getServiceUrlForOAuth();

    expect(serviceUrl).toBe('someNgrokServiceUrl');
  });

  it('should throw if failed to start up a new ngrok process for an oauth postback url', async () => {
    mockRunning.mockReturnValueOnce(false);
    mockConnect.mockRejectedValueOnce(new Error('Failed to start ngrok.'));
    try {
      await ngrokService.getServiceUrlForOAuth();
      expect(false); // fail test
    } catch (e) {
      expect(e).toEqual(
        new Error(`Failed to connect to ngrok instance for OAuth postback URL: ${new Error('Failed to start ngrok.')}`)
      );
    }
  });

  it('should shut down the ngrok oauth instance if it is running', () => {
    const mockKill = jest.fn(() => null);
    (ngrokService as any).oauthNgrokInstance = { kill: mockKill };
    ngrokService.shutDownOAuthNgrokInstance();

    expect(mockKill).toHaveBeenCalled();

    (ngrokService as any).oauthNgrokInstance = undefined;
  });
});
