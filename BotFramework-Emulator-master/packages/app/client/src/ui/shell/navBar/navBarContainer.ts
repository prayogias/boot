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

import { connect } from 'react-redux';
import { SharedConstants } from '@bfemulator/app-shared';

import * as Constants from '../../../constants';
import * as EditorActions from '../../../state/actions/editorActions';
import * as ExplorerActions from '../../../state/actions/explorerActions';
import * as NavBarActions from '../../../state/actions/navBarActions';
import { RootState } from '../../../state/store';
import { executeCommand } from '../../../state/actions/commandActions';

import { NavBarComponent, NavBarProps } from './navBar';

const mapStateToProps = (state: RootState): NavBarProps => ({
  notifications: state.notification.allIds,
  botIsOpen: !!state.bot.activeBot,
});

const mapDispatchToProps = (dispatch): NavBarProps => ({
  showExplorer: show => dispatch(ExplorerActions.showExplorer(show)),
  navBarSelectionChanged: newSelection => dispatch(NavBarActions.select(newSelection)),
  openEmulatorSettings: () => {
    const { CONTENT_TYPE_APP_SETTINGS, DOCUMENT_ID_APP_SETTINGS } = Constants;
    dispatch(
      EditorActions.open({
        contentType: CONTENT_TYPE_APP_SETTINGS,
        documentId: DOCUMENT_ID_APP_SETTINGS,
        isGlobal: true,
        meta: null,
      })
    );
  },
  trackEvent: (name: string, properties?: { [key: string]: any }) =>
    dispatch(executeCommand(true, SharedConstants.Commands.Telemetry.TrackEvent, null, name, properties)),
});

export const NavBar = connect(
  mapStateToProps,
  mapDispatchToProps
)(NavBarComponent);
