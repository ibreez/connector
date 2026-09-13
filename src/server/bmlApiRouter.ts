import express, { Request, Response } from 'express';
import { BmlTransactionConnector } from '../connector/bmlConnector';
import { MockBmlAdapter } from '../connector/mockBmlAdapter';
import { runAllConnectorTests } from '../tests/testRunner';

export function createBmlApiRouter(connector: BmlTransactionConnector): express.Router {
  const router = express.Router();
  router.use(express.json());

  // GET /api/bml/status
  router.get('/status', (req: Request, res: Response) => {
    const state = connector.getState();
    res.json({
      success: true,
      data: state,
    });
  });

  // GET /api/bml/accounts
  router.get('/accounts', (req: Request, res: Response) => {
    const accounts = connector.getAccounts();
    res.json({
      success: true,
      data: accounts,
    });
  });

  // GET /api/bml/transactions
  router.get('/transactions', (req: Request, res: Response) => {
    const incomingOnly = req.query.incomingOnly === 'true';
    const accountId = req.query.accountId as string;

    let list = incomingOnly ? connector.getIncomingTransfers() : connector.getTransactions();

    if (accountId) {
      list = list.filter((t) => t.accountId === accountId);
    }

    res.json({
      success: true,
      count: list.length,
      data: list,
    });
  });

  // POST /api/bml/connect
  router.post('/connect', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username is required to establish legitimate BML connection.',
      });
    }

    try {
      const result = await connector.connect(username, password);
      res.json({
        success: result.status !== 'FAILED',
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Connection attempt failed',
      });
    }
  });

  // POST /api/bml/authenticate (Submit OTP)
  router.post('/authenticate', async (req: Request, res: Response) => {
    const { challengeId, otp } = req.body;
    if (!challengeId || !otp) {
      return res.status(400).json({
        success: false,
        error: 'challengeId and otp are required.',
      });
    }

    try {
      const result = await connector.submitOtp(challengeId, otp);
      res.json({
        success: result.status === 'CONNECTED',
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'OTP verification failed',
      });
    }
  });

  // POST /api/bml/reauthenticate
  router.post('/reauthenticate', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username is required to re-authenticate with BML.',
      });
    }

    try {
      const result = await connector.connect(username, password);
      res.json({
        success: result.status !== 'FAILED',
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Re-authentication failed',
      });
    }
  });

  // POST /api/bml/sync
  router.post('/sync', async (req: Request, res: Response) => {
    try {
      const syncResult = await connector.syncTransactions();
      res.json({
        success: syncResult.success,
        data: syncResult,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Sync failed',
      });
    }
  });

  // POST /api/bml/disconnect
  router.post('/disconnect', async (req: Request, res: Response) => {
    try {
      await connector.disconnect();
      res.json({
        success: true,
        message: 'Successfully disconnected BML session.',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  // POST /api/bml/claim
  router.post('/claim', (req: Request, res: Response) => {
    const { fingerprint, orderId, staffName } = req.body;
    if (!fingerprint || !orderId) {
      return res.status(400).json({
        success: false,
        error: 'fingerprint and orderId are required to claim payment.',
      });
    }

    const ok = connector.claimPayment(fingerprint, orderId, staffName || 'Staff Member');
    res.json({
      success: ok,
      message: ok ? 'Payment claimed successfully' : 'Transaction not found or already claimed',
    });
  });

  // POST /api/bml/config
  router.post('/config', (req: Request, res: Response) => {
    const { pollingIntervalSeconds } = req.body;
    if (typeof pollingIntervalSeconds === 'number') {
      connector.setPollingInterval(pollingIntervalSeconds);
    }
    res.json({
      success: true,
      data: connector.getState(),
    });
  });

  // POST /api/bml/simulation/error-mode (for testing failure scenarios)
  router.post('/simulation/error-mode', (req: Request, res: Response) => {
    const { mode, shouldRequireOtp } = req.body;
    const adapter = connector.getAdapter();
    if (adapter instanceof MockBmlAdapter) {
      if (mode) adapter.errorMode = mode;
      if (typeof shouldRequireOtp === 'boolean') adapter.shouldRequireOtp = shouldRequireOtp;
      return res.json({
        success: true,
        message: `Simulation mode updated to ${adapter.errorMode}`,
      });
    }
    res.status(400).json({ success: false, error: 'Current adapter is not mock' });
  });

  // GET /api/bml/tests/run
  router.get('/tests/run', async (req: Request, res: Response) => {
    try {
      const suiteResult = await runAllConnectorTests();
      res.json({
        success: true,
        data: suiteResult,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  return router;
}
