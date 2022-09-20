use anchor_lang::prelude::*;

mod turn_crank;
mod push_buffer;

use turn_crank::*;
use push_buffer::*;


#[error_code]
pub enum MyErrorCode {
    #[msg("Withdrawals are blocked because there are games in progress")]
    WithdrawBlocked,
}

#[error_code]
#[derive(Eq, PartialEq)]
pub enum MyBufferErrorCode {
    #[msg("Not a valid Switchboard account")]
    InvalidSwitchboardAccount,
    #[msg("Failed to convert the buffer to a string!")]
    StringConversionFailed,
    #[msg("Bad game JSON schema!")]
    BadGameSchema,
}


declare_id!("9PcDy77KoSA9bNNuq7jQMczSmJg8rPFyAT9Ctt2APu3Y");

#[program]
pub mod switchboard_buffer {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    #[access_control(ctx.accounts.validate(&ctx))]
    pub fn turn_crank(
        ctx: Context<TurnCrank>,
    ) -> Result<()> {
        turn_crank::turn_crank(ctx)
    }

    pub fn push_buffer(
        ctx: Context<PushBuffer>,
    ) -> Result<()> {
        push_buffer::push_buffer(ctx)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
