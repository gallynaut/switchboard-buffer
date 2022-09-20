use anchor_lang::prelude::*;
use anchor_spl::token::{
    burn, Burn, close_account, CloseAccount, Mint, Token, TokenAccount, transfer, Transfer,
};
pub use switchboard_v2::{AggregatorAccountData, SWITCHBOARD_PROGRAM_ID};

use MyBufferErrorCode::InvalidSwitchboardAccount;
use MyErrorCode::WithdrawBlocked;

use super::*;

pub fn turn_crank(
    ctx: Context<TurnCrank>,
) -> Result<()> {

    msg!("Buffer action 1 success");

    Ok(())
}

#[derive(Accounts)]
pub struct TurnCrank<'info> {
    #[account(mut)]
    pub user_authority: Signer<'info>,
    #[account(
    constraint =
    *aggregator.to_account_info().owner == SWITCHBOARD_PROGRAM_ID @ InvalidSwitchboardAccount
    )]
    pub aggregator: AccountLoader<'info, AggregatorAccountData>,
}

impl TurnCrank<'_> {
    pub fn validate(&self, ctx: &Context<Self>) -> Result<()> {
        let feed = &ctx.accounts.aggregator.load()?;
        let h = feed.get_result();
        msg!("gg {:?}", h);
        let val: u64 = feed.get_result()?.try_into()?;
        if val > 0 {
            return Err(error!(WithdrawBlocked));
        }

        Ok(())
    }
}
