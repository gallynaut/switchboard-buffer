#!/bin/bash

mkdir -p .anchor/test-ledger

solana-test-validator -r --ledger .anchor/test-ledger --mint 3rGrMUKPVp8NzxC7pwxcj4hR3aHmCyKuFFVngH23UYTJ --bind-address 0.0.0.0 --url https://api.devnet.solana.com --rpc-port 8899  --clone 2TfB33aLaneQb5TNVwyDz3jSZXS6jdW2ARw1Dgf84XCG `# programId` \
--clone J4CArpsbrZqu1axqQ4AnrqREs3jwoyA1M5LMiQQmAzB9 `# programDataAddress` \
--clone CKwZcshn4XDvhaWVH9EXnk3iu19t6t5xP2Sy2pD6TRDp `# idlAddress` \
--clone BYM81n8HvTJuqZU1PmTVcwZ9G8uoji7FKM6EaPkwphPt `# programState` \
--clone FVLfR6C2ckZhbSwBzZY4CX7YBcddUSge5BNeGQv5eKhy `# switchboardVault` \
--clone So11111111111111111111111111111111111111112 `# switchboardMint` \
--clone 9mHKsQgdQGUYtZEcve2H5RMyvymyEeAcJJiHzvx6JSeA `# tokenWallet` \
--clone 91vSGQhSRS9tFXZajXnj14qCVkqXecnnfpZQpSU7kJYc `# queue` \
--clone 3rGrMUKPVp8NzxC7pwxcj4hR3aHmCyKuFFVngH23UYTJ `# queueAuthority` \
--clone 7jYV1p5X4ZUaq8KaQUP2NiNqDdJVR4Watpn6treCaSC8 `# queueBuffer` \
--clone 6BXk2CyJ1gVkJr4TUNxKvpi4qHxn4gtuGDzhBz4KqYk7 `# crank` \
--clone 5zgm6MiuPhqQSM7C5ZemkMtHEzkbxNRhJ4zt5XXJEYwy `# crankBuffer` \
--clone 43vYNKe8sX9odEjpFo75s9Czqu1Yo4q7FVgz9aPFRqVy `# oracle` \
--clone 3rGrMUKPVp8NzxC7pwxcj4hR3aHmCyKuFFVngH23UYTJ `# oracleAuthority` \
--clone 2pdrSNuzPz1DBk1RXXJiPwHdH5HCeemfkxBryA8ovGf6 `# oracleEscrow` \
--clone 6EjsLQssxSWSnGJzQNHQkNCs5Z9QDAKji29gg2srGRRZ `# oraclePermissions` 